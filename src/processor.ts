import * as fs from 'fs' // sync version
import * as fsPromises from 'fs/promises' // async version (Promise-based fs API)
import * as path from 'path'
import { splitBill, BillInput, BillOutput } from './core'

/**
 * 主程式入口點
 * @param args 命令列參數陣列
 * @description 解析命令列參數並執行相應的處理邏輯，支援單一檔案和批次處理模式
 */
export async function main(args: string[]): Promise<void> {
  try {
    // 基本輸入驗證
    if (!args || args.length < 2) {
      throw new Error('缺少必要的命令列參數')
    }
    
    // 解析命令列參數
    const { inputPath, outputPath } = parseArgs(args)
    
    // 驗證輸入路徑
    await validateInputPath(inputPath)
    
    // 驗證輸出路徑
    await validateOutputPath(outputPath)
    
    // 檢查輸入路徑是文件還是目錄
    const inputStat = await fsPromises.stat(inputPath)
    
    if (inputStat.isFile()) {
      // 單一檔案處理
      await processSingleFile(inputPath, outputPath)
    } else if (inputStat.isDirectory()) {
      // 批次處理目錄
      await processBatchFiles(inputPath, outputPath)
    } else {
      throw new Error(`不支援的輸入類型: ${inputPath}`)
    }
  } catch (error) {
    handleError(error, '主程式執行')
    throw error
  }
}

/**
 * 解析命令列參數
 * @param args 命令列參數陣列
 * @returns 解析後的輸入和輸出路徑
 */
function parseArgs(args: string[]): { inputPath: string; outputPath: string } {
  try {
    let inputPath = ''
    let outputPath = ''
    
    // 防護：確保 args 是陣列
    if (!Array.isArray(args)) {
      throw new Error('無效的命令列參數格式')
    }
    
    for (const arg of args) {
      // 防護：確保 arg 是字符串
      if (typeof arg !== 'string') {
        continue
      }
      
      if (arg.startsWith('--input=')) {
        inputPath = arg.substring(8).trim()
      } else if (arg.startsWith('--output=')) {
        outputPath = arg.substring(9).trim()
      }
    }
    
    // 驗證必要參數
    if (!inputPath) {
      throw new Error('必須提供 --input 參數')
    }
    
    if (!outputPath) {
      throw new Error('必須提供 --output 參數')
    }
    
    // 驗證路徑不為空字符串
    if (inputPath.length === 0) {
      throw new Error('--input 參數不能為空')
    }
    
    if (outputPath.length === 0) {
      throw new Error('--output 參數不能為空')
    }
    
    return { inputPath, outputPath }
  } catch (error: any) {
    throw new Error(`解析命令列參數時發生錯誤: ${error.message}`)
  }
}

/**
 * 處理單一檔案
 * @param inputPath 輸入檔案路徑
 * @param outputPath 輸出檔案路徑
 */
async function processSingleFile(inputPath: string, outputPath: string): Promise<void> {
  let inputData = ''
  let billInput: BillInput | null = null
  let billOutput: BillOutput | null = null
  
  try {
    // 防護：驗證參數
    if (!inputPath || !outputPath) {
      throw new Error('檔案路徑參數無效')
    }
    
    // 驗證輸入文件格式
    if (!path.extname(inputPath).toLowerCase().endsWith('.json')) {
      throw new Error(`不支援的檔案格式: ${inputPath}，僅支援 JSON 檔案`)
    }
    
    // 讀取輸入檔案
    inputData = await readFileWithValidation(inputPath)
    
    // 解析並驗證 JSON 格式
    billInput = parseAndValidateJSON(inputData, inputPath)
    
    // 防護：確保解析結果有效
    if (!billInput) {
      throw new Error(`無法解析輸入檔案: ${inputPath}`)
    }
    
    // 調用核心計算邏輯
    try {
      billOutput = splitBill(billInput)
    } catch (coreError: any) {
      throw new Error(`核心計算邏輯錯誤: ${coreError.message}`)
    }
    
    // 防護：確保計算結果有效
    if (!billOutput) {
      throw new Error(`計算結果無效: ${inputPath}`)
    }
    
    // 寫入輸出檔案
    await writeFileWithValidation(outputPath, billOutput)
    
    console.log(`已成功處理檔案: ${inputPath} -> ${outputPath}`)
  } catch (error: any) {
    // 提供詳細的錯誤上下文
    const context = `處理檔案 ${inputPath}`
    const detailedError = new Error(`${context}: ${error.message}`)
    
    // 添加調試信息（僅在開發模式）
    if (process.env.NODE_ENV === 'development') {
      console.error('🔍 調試信息:')
      console.error(`   輸入路徑: ${inputPath}`)
      console.error(`   輸出路徑: ${outputPath}`)
      console.error(`   輸入數據長度: ${inputData.length}`)
      console.error(`   解析結果: ${billInput ? '成功' : '失敗'}`)
      console.error(`   計算結果: ${billOutput ? '成功' : '失敗'}`)
    }
    
    handleError(detailedError, context)
    throw detailedError
  }
}

/**
 * 批次處理目錄中的檔案
 * @param inputDir 輸入目錄路徑
 * @param outputDir 輸出目錄路徑
 */
async function processBatchFiles(inputDir: string, outputDir: string): Promise<void> {
  let files: string[] = []
  let processedFiles: string[] = []
  let errorFiles: string[] = []
  
  try {
    // 防護：驗證參數
    if (!inputDir || !outputDir) {
      throw new Error('目錄路徑參數無效')
    }
    
    // 確保輸出目錄存在
    try {
      await fsPromises.mkdir(outputDir, { recursive: true })
    } catch (mkdirError: any) {
      throw new Error(`無法創建輸出目錄 ${outputDir}: ${mkdirError.message}`)
    }
    
    // 讀取輸入目錄中的所有檔案
    try {
      files = await fsPromises.readdir(inputDir)
    } catch (readdirError: any) {
      throw new Error(`無法讀取輸入目錄 ${inputDir}: ${readdirError.message}`)
    }
    
    // 防護：確保 files 是陣列
    if (!Array.isArray(files)) {
      throw new Error(`讀取目錄返回的不是檔案列表: ${inputDir}`)
    }
    
    // 過濾出 JSON 檔案和統計信息
    const jsonFiles = files.filter(file => {
      try {
        return typeof file === 'string' && file.endsWith('.json')
      } catch {
        return false
      }
    })
    
    const nonJsonFiles = files.filter(file => {
      try {
        return typeof file === 'string' && !file.endsWith('.json')
      } catch {
        return false
      }
    })
    
    console.log(`掃描目錄 ${inputDir}:`)
    console.log(`  - 找到 ${files.length} 個檔案`)
    console.log(`  - JSON 檔案: ${jsonFiles.length} 個`)
    if (nonJsonFiles.length > 0) {
      console.log(`  - 跳過非 JSON 檔案: ${nonJsonFiles.length} 個 (${nonJsonFiles.join(', ')})`)
    }
    
    if (jsonFiles.length === 0) {
      console.log(`在目錄 ${inputDir} 中未找到 JSON 檔案`)
      return
    }
    
    // 處理統計信息
    let successCount = 0
    let errorCount = 0
    
    // 處理每個 JSON 檔案
    for (const file of jsonFiles) {
      // 防護：確保檔案名有效
      if (!file || typeof file !== 'string') {
        console.error(`跳過無效的檔案名: ${file}`)
        continue
      }
      
      const inputPath = path.join(inputDir, file)
      const outputPath = path.join(outputDir, file)
      
      try {
        await processSingleFile(inputPath, outputPath)
        successCount++
        processedFiles.push(file)
      } catch (error: any) {
        errorCount++
        errorFiles.push(file)
        
        // 詳細的錯誤記錄，但不中斷批次處理
        console.error(`⚠️  處理檔案 ${file} 失敗: ${error.message}`)
        handleError(error, `批次處理中的檔案 ${file}`)
        // 繼續處理其他檔案，不拋出錯誤
      }
    }
    
    // 輸出統計報告
    console.log('\n批次處理完成:')
    console.log(`  - 成功處理: ${successCount} 個檔案`)
    if (successCount > 0) {
      console.log(`    ${processedFiles.join(', ')}`)
    }
    if (errorCount > 0) {
      console.log(`  - 處理失敗: ${errorCount} 個檔案`)
      console.log(`    ${errorFiles.join(', ')}`)
    }
    console.log(`  - 總處理時間: ${new Date().toLocaleTimeString()}`)
    
    // 如果所有檔案都失敗，拋出錯誤
    if (errorCount > 0 && successCount === 0) {
      throw new Error(`批次處理完全失敗：${errorCount} 個檔案都處理失敗`)
    }
    
  } catch (error: any) {
    // 提供詳細的錯誤上下文
    const context = `批次處理目錄 ${inputDir}`
    
    // 添加調試信息
    if (process.env.NODE_ENV === 'development') {
      console.error('🔍 批次處理調試信息:')
      console.error(`   輸入目錄: ${inputDir}`)
      console.error(`   輸出目錄: ${outputDir}`)
      console.error(`   掃描到的檔案數: ${files.length}`)
      console.error(`   處理成功: ${processedFiles.length}`)
      console.error(`   處理失敗: ${errorFiles.length}`)
    }
    
    handleError(error, context)
    throw error
  }
}

/**
 * 驗證輸入路徑是否存在且可讀
 * @param inputPath 輸入路徑
 */
async function validateInputPath(inputPath: string): Promise<void> {
  try {
    // 檢查路徑是否存在
    await fsPromises.access(inputPath, fs.constants.F_OK)
    
    // 檢查是否可讀
    await fsPromises.access(inputPath, fs.constants.R_OK)
    
    // 解析路徑，檢查是否為有效路徑
    const resolvedPath = path.resolve(inputPath)
    if (!resolvedPath) {
      throw new Error(`無效的輸入路徑: ${inputPath}`)
    }
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      throw new Error(`輸入檔案或目錄不存在: ${inputPath}`)
    } else if (error.code === 'EACCES') {
      throw new Error(`沒有權限讀取輸入檔案或目錄: ${inputPath}`)
    } else {
      throw new Error(`驗證輸入路徑時發生錯誤: ${error.message}`)
    }
  }
}

/**
 * 驗證輸出路徑是否可寫
 * @param outputPath 輸出路徑
 */
async function validateOutputPath(outputPath: string): Promise<void> {
  try {
    // 確保輸出目錄存在
    const outputDir = path.dirname(outputPath)
    await fsPromises.mkdir(outputDir, { recursive: true })
    
    // 檢查目錄是否可寫
    await fsPromises.access(outputDir, fs.constants.W_OK)
    
    // 如果輸出檔案已存在，檢查是否可寫
    try {
      await fsPromises.access(outputPath, fs.constants.F_OK)
      await fsPromises.access(outputPath, fs.constants.W_OK)
    } catch (error: any) {
      // 檔案不存在是正常的，我們會創建它
      if (error.code !== 'ENOENT') {
        throw error
      }
    }
  } catch (error: any) {
    if (error.code === 'EACCES') {
      throw new Error(`沒有權限寫入輸出路徑: ${outputPath}`)
    } else if (error.code === 'ENOTDIR') {
      throw new Error(`輸出路徑包含無效的目錄: ${outputPath}`)
    } else {
      throw new Error(`驗證輸出路徑時發生錯誤: ${error.message}`)
    }
  }
}

/**
 * 安全地讀取檔案並處理錯誤
 * @param filePath 檔案路徑
 * @returns 檔案內容
 */
async function readFileWithValidation(filePath: string): Promise<string> {
  try {
    return await fsPromises.readFile(filePath, 'utf-8')
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      throw new Error(`檔案不存在: ${filePath}`)
    } else if (error.code === 'EACCES') {
      throw new Error(`沒有權限讀取檔案: ${filePath}`)
    } else if (error.code === 'EISDIR') {
      throw new Error(`指定的路徑是目錄而非檔案: ${filePath}`)
    } else if (error.code === 'EMFILE' || error.code === 'ENFILE') {
      throw new Error(`系統檔案描述符不足，無法讀取檔案: ${filePath}`)
    } else {
      throw new Error(`讀取檔案時發生錯誤: ${filePath} - ${error.message}`)
    }
  }
}

/**
 * 解析並驗證 JSON 格式
 * @param data JSON 字符串
 * @param filePath 檔案路徑（用於錯誤訊息）
 * @returns 解析後的 BillInput 對象
 */
function parseAndValidateJSON(data: string, filePath: string): BillInput {
  try {
    if (!data.trim()) {
      throw new Error(`檔案內容為空: ${filePath}`)
    }
    
    const parsed = JSON.parse(data)
    
    // 驗證必要的欄位
    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error(`JSON 格式錯誤：根對象必須是一個物件`)
    }
    
    if (!parsed.date || typeof parsed.date !== 'string') {
      throw new Error(`缺少或無效的 'date' 欄位`)
    }
    
    if (!parsed.location || typeof parsed.location !== 'string') {
      throw new Error(`缺少或無效的 'location' 欄位`)
    }
    
    if (typeof parsed.tipPercentage !== 'number' || parsed.tipPercentage < 0) {
      throw new Error(`缺少或無效的 'tipPercentage' 欄位`)
    }
    
    if (!Array.isArray(parsed.items) || parsed.items.length === 0) {
      throw new Error(`缺少或無效的 'items' 欄位，必須是非空陣列`)
    }
    
    // 驗證每個項目
    for (let i = 0; i < parsed.items.length; i++) {
      const item = parsed.items[i]
      if (!item.name || typeof item.name !== 'string') {
        throw new Error(`項目 ${i + 1} 缺少或無效的 'name' 欄位`)
      }
      if (typeof item.price !== 'number' || item.price < 0) {
        throw new Error(`項目 ${i + 1} 缺少或無效的 'price' 欄位`)
      }
      if (typeof item.isShared !== 'boolean') {
        throw new Error(`項目 ${i + 1} 缺少或無效的 'isShared' 欄位`)
      }
      if (!item.isShared) {
        if (!item.person || typeof item.person !== 'string') {
          throw new Error(`個人項目 ${i + 1} 缺少或無效的 'person' 欄位`)
        }
      }
    }
    
    return parsed as BillInput
  } catch (error: any) {
    if (error instanceof SyntaxError) {
      throw new Error(`JSON 格式錯誤在檔案 ${filePath}: ${error.message}`)
    } else {
      throw new Error(`驗證 JSON 格式時發生錯誤在檔案 ${filePath}: ${error.message}`)
    }
  }
}

/**
 * 安全地寫入檔案並處理錯誤
 * @param filePath 檔案路徑
 * @param data 要寫入的數據
 */
async function writeFileWithValidation(filePath: string, data: BillOutput): Promise<void> {
  try {
    // 確保輸出目錄存在
    const outputDir = path.dirname(filePath)
    await fsPromises.mkdir(outputDir, { recursive: true })
    
    // 將數據轉換為格式化的 JSON
    const outputData = JSON.stringify(data, null, 2)
    
    // 寫入檔案
    await fsPromises.writeFile(filePath, outputData, 'utf-8')
  } catch (error: any) {
    if (error.code === 'EACCES') {
      throw new Error(`沒有權限寫入檔案: ${filePath}`)
    } else if (error.code === 'ENOSPC') {
      throw new Error(`磁碟空間不足，無法寫入檔案: ${filePath}`)
    } else if (error.code === 'ENOTDIR') {
      throw new Error(`輸出路徑包含無效的目錄: ${filePath}`)
    } else {
      throw new Error(`寫入檔案時發生錯誤: ${filePath} - ${error.message}`)
    }
  }
}

/**
 * 統一的錯誤處理函數
 * @param error 錯誤對象
 * @param context 錯誤發生的上下文
 */
function handleError(error: any, context: string): void {
  if (error.message) {
    console.error(`${context}時發生錯誤: ${error.message}`)
  } else {
    console.error(`${context}時發生未知錯誤:`, error)
  }
  
  // 根據錯誤類型提供建議
  if (error.code === 'ENOENT') {
    console.error('建議：請檢查檔案或目錄路徑是否正確')
  } else if (error.code === 'EACCES') {
    console.error('建議：請檢查檔案或目錄的讀寫權限')
  } else if (error.code === 'ENOSPC') {
    console.error('建議：請清理磁碟空間後重試')
  } else if (error.message && error.message.includes('JSON')) {
    console.error('建議：請檢查 JSON 檔案格式是否正確')
  }
}
