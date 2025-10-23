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
    // 解析命令列參數
    const { inputPath, outputPath } = parseArgs(args)
    
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
    console.error('處理過程中發生錯誤:', error)
    throw error
  }
}

/**
 * 解析命令列參數
 * @param args 命令列參數陣列
 * @returns 解析後的輸入和輸出路徑
 */
function parseArgs(args: string[]): { inputPath: string; outputPath: string } {
  let inputPath = ''
  let outputPath = ''
  
  for (const arg of args) {
    if (arg.startsWith('--input=')) {
      inputPath = arg.substring(8)
    } else if (arg.startsWith('--output=')) {
      outputPath = arg.substring(9)
    }
  }
  
  if (!inputPath || !outputPath) {
    throw new Error('必須提供 --input 和 --output 參數')
  }
  
  return { inputPath, outputPath }
}

/**
 * 處理單一檔案
 * @param inputPath 輸入檔案路徑
 * @param outputPath 輸出檔案路徑
 */
async function processSingleFile(inputPath: string, outputPath: string): Promise<void> {
  try {
    // 讀取輸入檔案
    const inputData = await fsPromises.readFile(inputPath, 'utf-8')
    const billInput: BillInput = JSON.parse(inputData)
    
    // 調用核心計算邏輯
    const billOutput: BillOutput = splitBill(billInput)
    
    // 確保輸出目錄存在
    const outputDir = path.dirname(outputPath)
    await fsPromises.mkdir(outputDir, { recursive: true })
    
    // 寫入輸出檔案
    const outputData = JSON.stringify(billOutput, null, 2)
    await fsPromises.writeFile(outputPath, outputData, 'utf-8')
    
    console.log(`已成功處理檔案: ${inputPath} -> ${outputPath}`)
  } catch (error) {
    console.error(`處理檔案時發生錯誤 ${inputPath}:`, error)
    throw error
  }
}

/**
 * 批次處理目錄中的檔案
 * @param inputDir 輸入目錄路徑
 * @param outputDir 輸出目錄路徑
 */
async function processBatchFiles(inputDir: string, outputDir: string): Promise<void> {
  try {
    // 確保輸出目錄存在
    await fsPromises.mkdir(outputDir, { recursive: true })
    
    // 讀取輸入目錄中的所有檔案
    const files = await fsPromises.readdir(inputDir)
    
    // 過濾出 JSON 檔案
    const jsonFiles = files.filter(file => file.endsWith('.json'))
    
    if (jsonFiles.length === 0) {
      console.log(`在目錄 ${inputDir} 中未找到 JSON 檔案`)
      return
    }
    
    // 處理每個 JSON 檔案
    for (const file of jsonFiles) {
      const inputPath = path.join(inputDir, file)
      const outputPath = path.join(outputDir, file)
      
      try {
        await processSingleFile(inputPath, outputPath)
      } catch (error) {
        console.error(`處理檔案 ${file} 時發生錯誤:`, error)
        // 繼續處理其他檔案，不拋出錯誤
      }
    }
    
    console.log(`批次處理完成，處理了 ${jsonFiles.length} 個檔案`)
  } catch (error) {
    console.error(`批次處理目錄時發生錯誤 ${inputDir}:`, error)
    throw error
  }
}
