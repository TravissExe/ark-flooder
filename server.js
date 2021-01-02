const { Transactions, Managers, Utils } = require("@arkecosystem/crypto");
const { Connection } = require("@arkecosystem/client");
const Config = require('./config.json')

const client = new Connection("https://dapi.ark.io/api");

Managers.configManager.setFromPreset("devnet");
Managers.configManager.setHeight(6338268);

let nonce = 0
let latestNonce = 0
let limitError = 0

const getWallet = async () => {
    return await client.api("wallets").get(Config.sender);
}

const setNonce = (wallet) => {
    nonce = Utils.BigNumber.make(wallet.body.data.nonce).plus(1)
    if(latestNonce!==0){
        nonce=latestNonce
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}  

const func = async () => {
    try {
        const transaction = Transactions.BuilderFactory.transfer()
            .version(2)
            .nonce(nonce)
            .recipientId(Config.receiver)
            .amount(1)
            .fee(1000000)
            .vendorField(``)
            .sign(Config.sender_psw)
            .secondSign(Config.sender_psw_2);

        const broadcastResponse = await client.api("transactions").create({ transactions: [transaction.build().toJson()] });
        if(broadcastResponse.body.errors){
            const errors = Object.keys(broadcastResponse.body.errors)
            if(errors.length>0){
                return await errors.map(async (key)=>{
                    const error = broadcastResponse.body.errors[key].type
                    if(error==='ERR_APPLY'){
                        console.log("🔥 ~ Error : Nonce", nonce)
                        await sleep(500)
                        return transactionProcess()
                    }
                    if(error === 'ERR_EXCEEDS_MAX_COUNT'){
                        latestNonce=nonce
                        console.log("🔥 ~ Error : Limit")
                        return func()
                    }
                    if(error === 'ERR_DUPLICATE'){
                        console.log("🔥 ~ Error : Duplicate")
                        nonce++
                        return func()
                    }
                })
            }
        }
        nonce++
        if(latestNonce!==0){
            latestNonce=0
        }
        if(limitError!==0){
            limitError=0
        }
        return func()
    } catch (error) {
        console.log(error)
        throw error
    }
}

const transactionProcess = async () => {
    const wallet = await getWallet()
    setNonce(wallet)
    func()
}

transactionProcess()
