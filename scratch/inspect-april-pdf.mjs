import { PDFParse } from 'pdf-parse'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

async function run() {
  const filePath = resolve(process.cwd(), '729e91e7-27fe-493b-9bb5-a7b25d683ffa.pdf')
  const dataBuffer = readFileSync(filePath)
  const parser = new PDFParse({ data: dataBuffer })
  const textResult = await parser.getText()
  const lines = textResult.text.split('\n').map(l => l.trim())

  console.log('--- Last 30 lines of April PDF ---')
  lines.slice(-40).forEach((line, idx) => {
    console.log(`${idx}: ${line}`)
  })
}

run().catch(console.error)
