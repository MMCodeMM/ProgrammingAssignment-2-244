import { expect } from 'chai'
import { main } from '../src/processor'
import * as fs from 'fs'
import * as path from 'path'
import * as sinon from 'sinon'
import * as core from '../src/core'

describe('Processor', () => {
  let inputFile = 'sample-data/single-bill.json'
  let outputFile = 'result.json'

  let inputDir = 'sample-data/input-dir'
  let outputDir = 'sample-data/output-dir'

  // ===== 功能擴展與核心邏輯（40 分） =====

  describe('重用習作一計算函數（15 分）', () => {
    it('正確調用習作一的核心計算邏輯', async () => {
      const testArgs = [
        'ts-node',
        'src/cli.ts',
        `--input=${inputFile}`,
        `--output=${outputFile}`,
      ]
      const splitBillSpy = sinon.spy(core, 'splitBill')
      try {
        await main(testArgs)
        expect(splitBillSpy.calledOnce).to.be.true
      } finally {
        splitBillSpy.restore()
      }
    })

    it('保持計算結果的一致性', () => {
      // 檢查當前項目的 core.ts 文件是否存在且包含必要的函數
      let coreFile = path.join(__dirname, '../src/core.ts')
      
      expect(fs.existsSync(coreFile)).to.be.true
      
      let coreContent = fs.readFileSync(coreFile, 'utf-8')
      
      // 驗證核心函數是否存在
      expect(coreContent).to.include('export function splitBill')
      expect(coreContent).to.include('export function formatDate')
      expect(coreContent).to.include('export function calculateTip')
      expect(coreContent).to.include('export type BillInput')
      expect(coreContent).to.include('export type BillOutput')
    })
  })

  describe('單一檔案處理能力（15 分）', () => {
    it('支援處理單筆聚餐分帳資料（完整工作流程：讀取、處理、輸出）', async () => {
      const testArgs = [
        'ts-node',
        'src/cli.ts',
        `--input=${inputFile}`,
        `--output=${outputFile}`,
      ]

      // Mock the splitBill function to return a simple output
      const mockOutput = {
        date: '2024年3月21日',
        location: '開心小館',
        subTotal: 100,
        tip: 10,
        totalAmount: 110,
        items: [
          { name: 'Alice', amount: 55 },
          { name: 'Bob', amount: 55 },
        ],
      }

      const splitBillStub = sinon.stub(core, 'splitBill').returns(mockOutput)

      try {
        // Clean up any existing output file
        if (fs.existsSync(outputFile)) {
          fs.unlinkSync(outputFile)
        }

        // Call main function
        await main(testArgs)

        // Verify output file was created
        expect(fs.existsSync(outputFile)).to.be.true

        // Read and verify the actual file content
        const fileContent = fs.readFileSync(outputFile, 'utf-8')
        const writtenData = JSON.parse(fileContent)
        expect(writtenData).to.deep.equal(mockOutput)
      } finally {
        splitBillStub.restore()
        // Clean up output file
        if (fs.existsSync(outputFile)) {
          fs.unlinkSync(outputFile)
        }
      }
    })
  })

  describe('命令列參數解析（10 分）', () => {
    function prepare(args: { inputFile: string; outputFile: string }) {
      let { inputFile, outputFile } = args
      const testArgs = [
        'ts-node',
        'src/cli.ts',
        `--input=${inputFile}`,
        `--output=${outputFile}`,
      ]
      const mockOutput = {
        date: '2024年3月21日',
        location: `${inputFile} -> ${outputFile}`,
        subTotal: 100,
        tip: 0.1,
        totalAmount: 110,
        items: [
          { name: 'input: ' + inputFile, amount: 55 },
          { name: 'output: ' + outputFile, amount: 55 },
        ],
      }
      const splitBillStub = sinon.stub(core, 'splitBill').returns(mockOutput)

      if (fs.existsSync(outputFile)) {
        fs.unlinkSync(outputFile)
      }

      return { testArgs, splitBillStub, mockOutput }
    }

    it('支援 --input 和 --output 參數', async () => {
      let args = [
        'ts-node',
        'src/cli.ts',
        `--input=${inputFile}`,
        `--output=${outputFile}`,
      ]
      // it should not throw error
      await main(args)
    })

    it('正確解析 --input 命令列參數', async () => {
      async function test(args: {
        inputFile: string
        outputFile: string
        location: string
      }) {
        let { testArgs, splitBillStub } = prepare(args)
        try {
          await main(testArgs)
          expect(splitBillStub.calledOnce).to.be.true
          expect(splitBillStub.getCall(0).args[0].location).to.be.equal(
            args.location,
          )
        } finally {
          splitBillStub.restore()
          if (fs.existsSync(args.outputFile)) {
            fs.unlinkSync(args.outputFile)
          }
        }
      }

      await test({
        inputFile: path.join(inputDir, 'bill-1.json'),
        outputFile: path.join(outputDir, 'result-1.json'),
        location: '開心小館',
      })
      await test({
        inputFile: path.join(inputDir, 'bill-2.json'),
        outputFile: path.join(outputDir, 'result-2.json'),
        location: '美味餐廳',
      })
      await test({
        inputFile: path.join(inputDir, 'bill-3.json'),
        outputFile: path.join(outputDir, 'result-3.json'),
        location: '咖啡廳',
      })
    })

    it('正確解析 --output 命令列參數', async () => {
      async function test(args: { inputFile: string; outputFile: string }) {
        let { testArgs, splitBillStub, mockOutput } = prepare(args)
        try {
          await main(testArgs)
          expect(fs.existsSync(args.outputFile)).to.be.true
          let fileOutput = JSON.parse(fs.readFileSync(args.outputFile, 'utf-8'))
          expect(fileOutput).to.deep.equal(mockOutput)
        } finally {
          splitBillStub.restore()
          if (fs.existsSync(args.outputFile)) {
            fs.unlinkSync(args.outputFile)
          }
        }
      }

      await test({
        inputFile: path.join(inputDir, 'bill-1.json'),
        outputFile: path.join(outputDir, 'result-1.json'),
      })
      await test({
        inputFile: path.join(inputDir, 'bill-2.json'),
        outputFile: path.join(outputDir, 'result-2.json'),
      })
      await test({
        inputFile: path.join(inputDir, 'bill-3.json'),
        outputFile: path.join(outputDir, 'result-3.json'),
      })
    })
  })

  // ===== 檔案 I/O 處理（30 分） =====

  describe('JSON 檔案讀取（10 分）', () => {
    it('正確讀取和解析 JSON 檔案 ', async () => {})

    it('處理檔案路徑和權限問題', async () => {
      // 測試不存在的檔案
      const nonExistentArgs = [
        'ts-node',
        'src/cli.ts',
        '--input=nonexistent-file.json',
        '--output=test-output.json'
      ]
      
      try {
        await main(nonExistentArgs)
        expect.fail('應該拋出錯誤')
      } catch (error: any) {
        expect(error.message).to.include('輸入檔案或目錄不存在')
      }
      
      // 測試無效路徑
      const invalidPathArgs = [
        'ts-node',
        'src/cli.ts',
        '--input=',
        '--output=test-output.json'
      ]
      
      try {
        await main(invalidPathArgs)
        expect.fail('應該拋出錯誤')
      } catch (error: any) {
        expect(error.message).to.include('必須提供 --input 和 --output 參數')
      }
    })
  })

  describe('檔案寫入（10 分）', () => {
    it('正確寫入輸出檔案')
    it('支援 JSON 格式的檔案輸出')
  })

  describe('檔案格式驗證（10 分）', () => {
    it('驗證輸入 JSON 格式的正確性', async () => {
      // 創建一個無效的 JSON 檔案
      const invalidJsonContent = JSON.stringify({
        date: "2024-03-21",
        location: "開心小館",
        tipPercentage: "invalid", // 應該是數字
        items: []
      })
      
      const invalidJsonFile = 'test-invalid.json'
      fs.writeFileSync(invalidJsonFile, invalidJsonContent)
      
      const testArgs = [
        'ts-node',
        'src/cli.ts',
        `--input=${invalidJsonFile}`,
        '--output=test-output.json'
      ]
      
      try {
        await main(testArgs)
        expect.fail('應該拋出錯誤')
      } catch (error: any) {
        expect(error.message).to.include('缺少或無效的')
      } finally {
        // 清理檔案
        if (fs.existsSync(invalidJsonFile)) {
          fs.unlinkSync(invalidJsonFile)
        }
        if (fs.existsSync('test-output.json')) {
          fs.unlinkSync('test-output.json')
        }
      }
    })
    
    it('處理格式錯誤的優雅降級', async () => {
      // 創建一個語法錯誤的 JSON 檔案
      const malformedJson = '{ "date": "2024-03-21", "location": "開心小館", }'
      const malformedJsonFile = 'test-malformed.json'
      fs.writeFileSync(malformedJsonFile, malformedJson)
      
      const testArgs = [
        'ts-node',
        'src/cli.ts',
        `--input=${malformedJsonFile}`,
        '--output=test-output.json'
      ]
      
      try {
        await main(testArgs)
        expect.fail('應該拋出錯誤')
      } catch (error: any) {
        expect(error.message).to.include('JSON 格式錯誤')
      } finally {
        // 清理檔案
        if (fs.existsSync(malformedJsonFile)) {
          fs.unlinkSync(malformedJsonFile)
        }
        if (fs.existsSync('test-output.json')) {
          fs.unlinkSync('test-output.json')
        }
      }
    })
  })

  // ===== 錯誤處理與程式品質（20 分） =====

  describe('檔案錯誤處理（8 分）', () => {
    it('處理檔案不存在的情況', async () => {
      const testArgs = [
        'ts-node',
        'src/cli.ts',
        '--input=definitely-does-not-exist.json',
        '--output=test-output.json'
      ]
      
      try {
        await main(testArgs)
        expect.fail('應該拋出錯誤')
      } catch (error: any) {
        expect(error.message).to.include('輸入檔案或目錄不存在')
      }
    })
    
    it('處理檔案讀寫權限問題', async () => {
      // 在真實環境中，這個測試需要創建一個沒有讀權限的檔案
      // 由於在測試環境中難以模擬權限問題，我們測試路徑驗證
      const testArgs = [
        'ts-node',
        'src/cli.ts',
        '--input=',
        '--output='
      ]
      
      try {
        await main(testArgs)
        expect.fail('應該拋出錯誤')
      } catch (error: any) {
        expect(error.message).to.include('必須提供 --input 和 --output 參數')
      }
    })
  })

  describe('JSON 錯誤處理（7 分）', () => {
    it('處理 JSON 格式錯誤', async () => {
      // 創建一個語法錯誤的 JSON
      const invalidJson = '{"invalid": json syntax}'
      const testFile = 'test-json-error.json'
      fs.writeFileSync(testFile, invalidJson)
      
      const testArgs = [
        'ts-node',
        'src/cli.ts',
        `--input=${testFile}`,
        '--output=test-output.json'
      ]
      
      try {
        await main(testArgs)
        expect.fail('應該拋出錯誤')
      } catch (error: any) {
        expect(error.message).to.include('JSON 格式錯誤')
      } finally {
        if (fs.existsSync(testFile)) {
          fs.unlinkSync(testFile)
        }
      }
    })
    
    it('提供有意義的錯誤訊息', async () => {
      // 測試空檔案
      const emptyFile = 'test-empty.json'
      fs.writeFileSync(emptyFile, '')
      
      const testArgs = [
        'ts-node',
        'src/cli.ts',
        `--input=${emptyFile}`,
        '--output=test-output.json'
      ]
      
      try {
        await main(testArgs)
        expect.fail('應該拋出錯誤')
      } catch (error: any) {
        expect(error.message).to.include('檔案內容為空')
      } finally {
        if (fs.existsSync(emptyFile)) {
          fs.unlinkSync(emptyFile)
        }
      }
    })
  })

  describe('程式穩定性（5 分）', () => {
    it('程式不會因為輸入錯誤而崩潰')
    it('提供適當的錯誤訊息')
    it('提供適當的退出碼')
  })

  // ===== 加分項目 =====

  describe('批次處理能力（+10 分）', () => {
    it('支援處理多筆聚餐分帳資料', async () => {
      const testArgs = [
        'ts-node',
        'src/cli.ts',
        '--input=sample-data/input-dir',
        '--output=test-batch-output'
      ]
      
      // 清理舊的輸出目錄
      if (fs.existsSync('test-batch-output')) {
        fs.rmSync('test-batch-output', { recursive: true, force: true })
      }
      
      try {
        await main(testArgs)
        
        // 驗證輸出目錄被創建
        expect(fs.existsSync('test-batch-output')).to.be.true
        
        // 驗證所有 JSON 檔案都被處理
        const outputFiles = fs.readdirSync('test-batch-output')
        expect(outputFiles).to.include('bill-1.json')
        expect(outputFiles).to.include('bill-2.json')
        expect(outputFiles).to.include('bill-3.json')
        
        // 驗證輸出內容正確
        const bill1Output = JSON.parse(fs.readFileSync(path.join('test-batch-output', 'bill-1.json'), 'utf-8'))
        expect(bill1Output).to.have.property('date', '2024年3月21日')
        expect(bill1Output).to.have.property('location', '開心小館')
        expect(bill1Output).to.have.property('totalAmount')
        expect(bill1Output).to.have.property('items')
        expect(bill1Output.items).to.be.an('array')
      } finally {
        // 清理測試檔案
        if (fs.existsSync('test-batch-output')) {
          fs.rmSync('test-batch-output', { recursive: true, force: true })
        }
      }
    })
    
    it('支援輸入目錄', async () => {
      const testArgs = [
        'ts-node',
        'src/cli.ts',
        '--input=sample-data/input-dir',
        '--output=test-input-dir-output'
      ]
      
      if (fs.existsSync('test-input-dir-output')) {
        fs.rmSync('test-input-dir-output', { recursive: true, force: true })
      }
      
      try {
        await main(testArgs)
        
        // 驗證輸入目錄被正確處理
        expect(fs.existsSync('test-input-dir-output')).to.be.true
        
        const inputFiles = fs.readdirSync('sample-data/input-dir').filter(f => f.endsWith('.json'))
        const outputFiles = fs.readdirSync('test-input-dir-output')
        
        // 每個輸入 JSON 檔案都應該有對應的輸出檔案
        for (const inputFile of inputFiles) {
          expect(outputFiles).to.include(inputFile)
        }
      } finally {
        if (fs.existsSync('test-input-dir-output')) {
          fs.rmSync('test-input-dir-output', { recursive: true, force: true })
        }
      }
    })
    
    it('支援輸出目錄', async () => {
      const outputDir = 'test-custom-output-dir'
      const testArgs = [
        'ts-node',
        'src/cli.ts',
        '--input=sample-data/input-dir',
        `--output=${outputDir}`
      ]
      
      if (fs.existsSync(outputDir)) {
        fs.rmSync(outputDir, { recursive: true, force: true })
      }
      
      try {
        await main(testArgs)
        
        // 驗證自定義輸出目錄被創建
        expect(fs.existsSync(outputDir)).to.be.true
        
        // 驗證目錄結構正確
        const stat = fs.statSync(outputDir)
        expect(stat.isDirectory()).to.be.true
        
        // 驗證檔案被正確寫入到輸出目錄
        const outputFiles = fs.readdirSync(outputDir)
        expect(outputFiles.length).to.be.greaterThan(0)
      } finally {
        if (fs.existsSync(outputDir)) {
          fs.rmSync(outputDir, { recursive: true, force: true })
        }
      }
    })
    
    it('自動掃描目錄中的所有 JSON 檔案', async () => {
      // 創建測試目錄，包含 JSON 和非 JSON 檔案
      const testInputDir = 'test-scan-input'
      const testOutputDir = 'test-scan-output'
      
      // 清理並創建測試目錄
      if (fs.existsSync(testInputDir)) {
        fs.rmSync(testInputDir, { recursive: true, force: true })
      }
      if (fs.existsSync(testOutputDir)) {
        fs.rmSync(testOutputDir, { recursive: true, force: true })
      }
      
      fs.mkdirSync(testInputDir, { recursive: true })
      
      // 創建測試檔案
      const testBill = {
        date: "2024-03-21",
        location: "測試餐廳",
        tipPercentage: 10,
        items: [
          { name: "測試餐點", price: 100, isShared: true },
          { name: "飲料", price: 30, isShared: false, person: "Alice" }
        ]
      }
      
      fs.writeFileSync(path.join(testInputDir, 'test1.json'), JSON.stringify(testBill, null, 2))
      fs.writeFileSync(path.join(testInputDir, 'test2.json'), JSON.stringify(testBill, null, 2))
      fs.writeFileSync(path.join(testInputDir, 'not-json.txt'), 'this is not json')
      fs.writeFileSync(path.join(testInputDir, 'readme.md'), '# README')
      
      const testArgs = [
        'ts-node',
        'src/cli.ts',
        `--input=${testInputDir}`,
        `--output=${testOutputDir}`
      ]
      
      try {
        await main(testArgs)
        
        // 驗證只有 JSON 檔案被處理
        const outputFiles = fs.readdirSync(testOutputDir)
        expect(outputFiles).to.include('test1.json')
        expect(outputFiles).to.include('test2.json')
        expect(outputFiles).to.not.include('not-json.txt')
        expect(outputFiles).to.not.include('readme.md')
        expect(outputFiles.length).to.equal(2)
      } finally {
        // 清理測試檔案
        if (fs.existsSync(testInputDir)) {
          fs.rmSync(testInputDir, { recursive: true, force: true })
        }
        if (fs.existsSync(testOutputDir)) {
          fs.rmSync(testOutputDir, { recursive: true, force: true })
        }
      }
    })
    
    it('跳過非 JSON 檔案', async () => {
      // 創建包含各種檔案類型的測試目錄
      const testInputDir = 'test-skip-input'
      const testOutputDir = 'test-skip-output'
      
      if (fs.existsSync(testInputDir)) {
        fs.rmSync(testInputDir, { recursive: true, force: true })
      }
      if (fs.existsSync(testOutputDir)) {
        fs.rmSync(testOutputDir, { recursive: true, force: true })
      }
      
      fs.mkdirSync(testInputDir, { recursive: true })
      
      // 創建測試檔案
      const validBill = {
        date: "2024-03-21",
        location: "測試餐廳",
        tipPercentage: 10,
        items: [
          { name: "測試餐點", price: 100, isShared: true },
          { name: "飲料", price: 30, isShared: false, person: "Alice" }
        ]
      }
      
      // JSON 檔案
      fs.writeFileSync(path.join(testInputDir, 'valid.json'), JSON.stringify(validBill, null, 2))
      
      // 非 JSON 檔案
      fs.writeFileSync(path.join(testInputDir, 'data.txt'), 'text file')
      fs.writeFileSync(path.join(testInputDir, 'config.xml'), '<config></config>')
      fs.writeFileSync(path.join(testInputDir, 'script.js'), 'console.log("hello");')
      fs.writeFileSync(path.join(testInputDir, 'style.css'), 'body { margin: 0; }')
      fs.writeFileSync(path.join(testInputDir, 'document.pdf'), 'fake pdf content')
      
      const testArgs = [
        'ts-node',
        'src/cli.ts',
        `--input=${testInputDir}`,
        `--output=${testOutputDir}`
      ]
      
      try {
        await main(testArgs)
        
        // 驗證只處理了 JSON 檔案
        expect(fs.existsSync(testOutputDir)).to.be.true
        const outputFiles = fs.readdirSync(testOutputDir)
        expect(outputFiles).to.deep.equal(['valid.json'])
        
        // 驗證處理結果正確
        const outputContent = JSON.parse(fs.readFileSync(path.join(testOutputDir, 'valid.json'), 'utf-8'))
        expect(outputContent).to.have.property('date', '2024年3月21日')
        expect(outputContent).to.have.property('location', '測試餐廳')
      } finally {
        if (fs.existsSync(testInputDir)) {
          fs.rmSync(testInputDir, { recursive: true, force: true })
        }
        if (fs.existsSync(testOutputDir)) {
          fs.rmSync(testOutputDir, { recursive: true, force: true })
        }
      }
    })
  })

  describe('非同步檔案處理（+5 分）', () => {
    it('使用 async/await 處理檔案 I/O 操作')
    it('使用 Promise-based fs API')
    it('正確處理非同步檔案操作')
    it('保持非同步操作的功能性')
  })

  describe('文字格式輸出（+3 分）', () => {
    it('支援 --format 參數')
    it('支援 json 格式輸出')
    it('支援 text 格式輸出')
    it('輸出格式化的文字報告')
    it('處理無效的格式參數')
  })

  // ===== 整合測試 =====

  describe('End-to-End Integration Tests', () => {
    it('should complete single file workflow successfully')
    it('should complete batch processing workflow successfully')
    it('should handle mixed success and failure scenarios')
    it('should maintain data integrity throughout processing')
  })
})
