import { main } from './processor'

async function runCLI() {
  try {
    await main(process.argv)
  } catch (error) {
    console.error(error)
    process.exit(1)
  }
}

runCLI()
