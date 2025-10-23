import { main } from './processor'

async function runCLI() {
  try {
    await main(process.argv)
    // 成功執行，正常退出
    process.exit(0)
  } catch (error: any) {
    // 統一的錯誤處理和退出碼
    handleCLIError(error)
  }
}

/**
 * CLI 錯誤處理函數
 * @param error 錯誤對象
 */
function handleCLIError(error: any): void {
  // 根據錯誤類型決定退出碼
  let exitCode = 1 // 預設錯誤碼
  
  if (error && error.message) {
    const message = error.message.toLowerCase()
    
    if (message.includes('必須提供') || message.includes('參數')) {
      // 參數錯誤
      console.error('❌ 參數錯誤:', error.message)
      console.error('📖 使用方法: ts-node src/cli.ts --input=<檔案或目錄> --output=<檔案或目錄>')
      exitCode = 2
    } else if (message.includes('不存在') || message.includes('enoent')) {
      // 檔案不存在
      console.error('❌ 檔案錯誤:', error.message)
      exitCode = 3
    } else if (message.includes('權限') || message.includes('eacces')) {
      // 權限錯誤
      console.error('❌ 權限錯誤:', error.message)
      exitCode = 4
    } else if (message.includes('json') || message.includes('格式')) {
      // JSON 格式錯誤
      console.error('❌ 格式錯誤:', error.message)
      exitCode = 5
    } else {
      // 一般錯誤
      console.error('❌ 執行錯誤:', error.message)
      exitCode = 1
    }
  } else {
    console.error('❌ 發生未知錯誤:', error)
    exitCode = 99
  }
  
  // 提供幫助信息
  console.error('\n💡 如需幫助，請檢查：')
  console.error('   1. 檔案路徑是否正確')
  console.error('   2. 檔案權限是否足夠')
  console.error('   3. JSON 格式是否有效')
  
  process.exit(exitCode)
}

// 處理未捕獲的異常，防止程式崩潰
process.on('uncaughtException', (error) => {
  console.error('💥 程式發生嚴重錯誤:', error.message)
  console.error('📋 錯誤詳情:', error)
  process.exit(98)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 未處理的 Promise 拒絕:', reason)
  console.error('📋 Promise:', promise)
  process.exit(97)
})

runCLI()
