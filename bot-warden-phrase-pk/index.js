const {
  Connection,
  PublicKey,
  LAMPORTS_PER_WARD,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
  Keypair,
} = require('@warden/web3.js')
const bip39 = require('bip39')
const { derivePath } = require('ed25519-hd-key')
const bs58 = require('bs58')
require('dotenv').config()

const TESNET_URL = 'https://testnet.wardenprotocol.org/'
const connection = new Connection(TESNET_URL, 'confirmed')
const keypairs = []

async function sendWrd(fromKeypair, toPublicKey, amount) {
  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: fromKeypair.publicKey,
      toPubkey: toPublicKey,
      lamports: amount * LAMPORTS_PER_WARD,
    })
  )

  const signature = await sendAndConfirmTransaction(connection, transaction, [fromKeypair])

  console.log('Transaction confirmed with signature:', signature)
}

function generateRandomAddresses(count) {
  const addresses = []
  for (let i = 0; i < count; i++) {
    const keypair = Keypair.generate()
    addresses.push(keypair.publicKey.toString())
  }
  return addresses
}

async function getKeypairFromSeed(seedPhrase) {
  const seed = await bip39.mnemonicToSeed(seedPhrase)
  const derivedSeed = derivePath("m/44'/501'/0'/0'", seed.toString('hex')).key
  return Keypair.fromSeed(derivedSeed.slice(0, 32))
}

function getKeypairFromPrivateKey(privateKey) {
  const decoded = bs58.decode(privateKey)
  return Keypair.fromSecretKey(decoded)
}

function parseEnvArray(envVar) {
  try {
    return JSON.parse(envVar)
  } catch (e) {
    console.error('Failed to parse environment variable:', envVar, e)
    return []
  }
}

async function getWardenBalance(fromKeypair) {
  return connection.getBalance(fromKeypair.publicKey)
}

async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

;(async () => {
  const seedPhrases = parseEnvArray(process.env.SEED_PHRASES)
  const privateKeys = parseEnvArray(process.env.PRIVATE_KEYS)

  for (const seedPhrase of seedPhrases) {
    keypairs.push(await getKeypairFromSeed(seedPhrase))
  }

  for (const privateKey of privateKeys) {
    keypairs.push(getKeypairFromPrivateKey(privateKey))
  }

  if (keypairs.length === 0) {
    throw new Error('No valid SEED_PHRASES or PRIVATE_KEYS found in the .env file')
  }

  const randomAddresses = generateRandomAddresses(keypairs.length * 100)
  console.log(Generated ${keypairs.length * 100} random addresses:, randomAddresses)

  const amountToSend = 0.001 //minimum 0.001 ward
  let currentKeypairIndex = 0
  const delayBetweenRequests = 5000 //replace if the network is congested

  const wardBalance = (await getWardenBalance(keypairs[currentKeypairIndex])) / LAMPORTS_PER_WARD
  if (wardBalance <= 0) {
    console.log(Insufficient balance: ${wardBalance} WARD)
    return
  }
  if (wardBalance < amountToSend * 100) {
    console.log(Insufficient balance: ${wardBalance} WARD)
    return
  }

  for (const address of randomAddresses) {
    const toPublicKey = new PublicKey(address)

    try {
      await sendWard(keypairs[currentKeypairIndex], toPublicKey, amountToSend)
      console.log(Successfully sent ${amountToSend} WARD to ${address})
    } catch (error) {
      console.error(Failed to send WARD to ${address}:, error)
    }
    currentKeypairIndex = (currentKeypairIndex + 1) % keypairs.length
    await delay(delayBetweenRequests)
  }
})()
