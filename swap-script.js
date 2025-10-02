const CONFIG = {
    mainnet: {
        vntSwapAddress: "0xb0EDd3955E50d12c1d39e67Ad36AD866198272fd", 
        vntTokenAddress: "0xD379Fd70C5C334bb31208122A6781ADB032D176f", 
        usdtTokenAddress: "0x55d398326f99059fF775485246999027B3197955", 
        chainId: "0x38", // BSC Mainnet chain ID
        rpcUrl: "https://bsc-dataseed.binance.org/"
    }
};

let web3;
let swapContract;
let vntToken;
let usdtToken;
let currentAccount = null;
let minSellAmount = 0;
let vntDecimals = 18;
let usdtDecimals = 18;

window.addEventListener('load', async () => {
    await setupEventListeners();
    await checkWalletConnection();
    await initContracts();
    setupInputListener();
    updateUI();
});

async function setupEventListeners() {
    document.getElementById('connectWalletBtn').addEventListener('click', connectWallet);
    document.getElementById('approveBtn').addEventListener('click', approveVNT);
    document.getElementById('sellBtn').addEventListener('click', sellVNT);
    document.getElementById('copyContractBtn').addEventListener('click', copyContractAddress);
}

function setupInputListener() {
    const vntAmountInput = document.getElementById('vntAmount');
    vntAmountInput.addEventListener('input', async () => {
        if (currentAccount) {
            await calculateQuote();
        }
    });
}

function toTokenUnits(amount, decimals = 18) {
    return web3.utils.toBN(amount).mul(web3.utils.toBN(10).pow(web3.utils.toBN(decimals)));
}

async function calculateQuote() {
    try {
        const vntAmountInput = document.getElementById('vntAmount').value;
        
        if (!vntAmountInput || isNaN(vntAmountInput)) {
            document.getElementById('quoteResult').classList.add('hidden');
            return;
        }
        
        const vntAmount = toTokenUnits(vntAmountInput, vntDecimals);
        const minSell = web3.utils.toBN(minSellAmount);
        
        if (vntAmount.lt(minSell)) {
            document.getElementById('quoteResult').classList.add('hidden');
            return;
        }
        
        const usdtAmount = await swapContract.methods.getQuote(vntAmount.toString()).call();
        
        document.getElementById('usdtAmount').textContent = formatUnits(usdtAmount, usdtDecimals);
        document.getElementById('quoteResult').classList.remove('hidden');
        
        const isApproved = await checkApprovalStatus(vntAmount.toString());
        document.getElementById('approveBtn').disabled = isApproved;
        document.getElementById('sellBtn').disabled = !isApproved;
        
    } catch (error) {
        console.error('Quote calculation error:', error);
        document.getElementById('quoteResult').classList.add('hidden');
    }
}

async function checkWalletConnection() {
    if (window.ethereum) {
        try {
            const accounts = await window.ethereum.request({ method: 'eth_accounts' });
            if (accounts.length > 0) {
                currentAccount = accounts[0];
                setupWalletEvents();
            }
        } catch (error) {
            console.error("Error checking wallet connection:", error);
        }
    }
}

function setupWalletEvents() {
    if (window.ethereum) {
        window.ethereum.on('accountsChanged', (accounts) => {
            currentAccount = accounts.length > 0 ? accounts[0] : null;
            updateUI();
            if (currentAccount) calculateQuote();
        });
        
        window.ethereum.on('chainChanged', () => {
            window.location.reload();
        });
        
        window.ethereum.on('disconnect', (error) => {
            console.log('Wallet disconnected:', error);
            currentAccount = null;
            updateUI();
        });
    }
}

async function connectWallet() {
    if (!window.ethereum) {
        showMessage('Please install MetaMask or another Web3 wallet', 'error');
        return;
    }

    try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        currentAccount = accounts[0];
        setupWalletEvents();
        
        const vntBalance = await vntToken.methods.balanceOf(currentAccount).call();
        
        document.getElementById('walletAddress').textContent = shortenAddress(currentAccount);
        document.getElementById('vntBalance').textContent = formatUnits(vntBalance, vntDecimals);
        document.getElementById('walletInfo').classList.remove('hidden');
        
        showMessage('Wallet connected successfully', 'success');
        updateUI();
        await calculateQuote();
    } catch (error) {
        if (error.code === 4001) {
            showMessage('User rejected connection request', 'error');
        } else {
            showMessage(`Error connecting wallet: ${error.message}`, 'error');
        }
    }
}

async function initContracts() {
    try {
        const config = CONFIG.mainnet;
        web3 = new Web3(window.ethereum || config.rpcUrl);
        
        const swapABI = [{"inputs":[{"internalType":"address","name":"_vntToken","type":"address"},{"internalType":"address","name":"_usdtToken","type":"address"},{"internalType":"address","name":"_buyerWallet","type":"address"},{"internalType":"address","name":"_vntReceiver","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"current","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"required","type":"uint256"}],"name":"BuyerAllowanceLow","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"newMinSell","type":"uint256"}],"name":"MinSellUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"previousOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"newPrice","type":"uint256"}],"name":"PriceUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"newReceiver","type":"address"}],"name":"ReceiverUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"seller","type":"address"},{"indexed":false,"internalType":"uint256","name":"current","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"required","type":"uint256"}],"name":"SellerAllowanceLow","type":"event"},{"anonymous":false,"inputs":[],"name":"SwapPaused","type":"event"},{"anonymous":false,"inputs":[],"name":"SwapResumed","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"seller","type":"address"},{"indexed":false,"internalType":"uint256","name":"vntAmount","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"usdtAmount","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"rateUsed","type":"uint256"}],"name":"TokensSold","type":"event"},{"stateMutability":"payable","type":"fallback"},{"inputs":[],"name":"buyerWallet","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"vntAmount","type":"uint256"}],"name":"calculateUsdtAmount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getBuyerAllowance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getPricePerVNT","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"vntAmount","type":"uint256"}],"name":"getQuote","outputs":[{"internalType":"uint256","name":"usdtAmount","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"seller","type":"address"}],"name":"getSellerAllowance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getTotalBought","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"seller","type":"address"}],"name":"isApproved","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"isBuyerApproved","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"isPaused","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"minSell","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"pauseSwap","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"resumeSwap","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"uint8","name":"fromDecimals","type":"uint8"},{"internalType":"uint8","name":"toDecimals","type":"uint8"}],"name":"scaleDecimals","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"pure","type":"function"},{"inputs":[{"internalType":"uint256","name":"vntAmount","type":"uint256"}],"name":"sellVNT","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"totalBought","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"totalSold","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"newMinSell","type":"uint256"}],"name":"updateMinSell","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"newPrice","type":"uint256"}],"name":"updatePrice","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"newReceiver","type":"address"}],"name":"updateReceiver","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"usdtDecimals","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"usdtToken","outputs":[{"internalType":"contract IERC20","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"vntDecimals","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"vntPrice","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"vntReceiver","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"vntToken","outputs":[{"internalType":"contract IERC20","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"stateMutability":"payable","type":"receive"}];
        const tokenABI = [{"inputs":[{"internalType":"address","name":"_usdtAddress","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"account","type":"address"},{"indexed":true,"internalType":"address","name":"by","type":"address"}],"name":"AddressBlacklisted","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"account","type":"address"},{"indexed":true,"internalType":"address","name":"by","type":"address"}],"name":"AddressWhitelisted","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"spender","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"FeeCollected","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"previousOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"account","type":"address"}],"name":"Paused","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"role","type":"bytes32"},{"indexed":true,"internalType":"address","name":"account","type":"address"},{"indexed":true,"internalType":"address","name":"sender","type":"address"}],"name":"RoleGranted","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"role","type":"bytes32"},{"indexed":true,"internalType":"address","name":"account","type":"address"},{"indexed":true,"internalType":"address","name":"sender","type":"address"}],"name":"RoleRevoked","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Transfer","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"oldFee","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"newFee","type":"uint256"},{"indexed":true,"internalType":"address","name":"by","type":"address"}],"name":"TransferFeeChanged","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"account","type":"address"}],"name":"Unpaused","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"newPrice","type":"uint256"}],"name":"VNTPriceUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"buyer","type":"address"},{"indexed":false,"internalType":"uint256","name":"vntAmount","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"usdtAmount","type":"uint256"}],"name":"VNTPurchased","type":"event"},{"stateMutability":"payable","type":"fallback"},{"inputs":[],"name":"ADMIN_ROLE","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"BLACKLIST_MANAGER_ROLE","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"FEE_MANAGER_ROLE","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"PAUSER_ROLE","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"_owner","type":"address"},{"internalType":"address","name":"spender","type":"address"}],"name":"allowance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"approve","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"_account","type":"address"}],"name":"blacklist","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"vntAmount","type":"uint256"}],"name":"buyVNST","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"decimals","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"subtractedValue","type":"uint256"}],"name":"decreaseAllowance","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"vntAmount","type":"uint256"}],"name":"getUSDTRequiredForVNST","outputs":[{"internalType":"uint256","name":"usdtRequired","type":"uint256"},{"internalType":"uint256","name":"usdtAllowance","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"grantRole","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"hasRole","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"addedValue","type":"uint256"}],"name":"increaseAllowance","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"isBlacklisted","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"isPaused","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"pause","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"revokeRole","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"","type":"bytes32"},{"internalType":"address","name":"","type":"address"}],"name":"roles","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"newFee","type":"uint256"}],"name":"setTransferFee","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"newPrice","type":"uint256"}],"name":"setVNTPrice","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"totalSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"transfer","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"transferFeePercent","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"transferFrom","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"unpause","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"usdtTokenAddress","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"vntPriceInUSDT","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"_account","type":"address"}],"name":"whitelist","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"address","name":"to","type":"address"}],"name":"withdrawUSDT","outputs":[],"stateMutability":"nonpayable","type":"function"},{"stateMutability":"payable","type":"receive"}];

        swapContract = new web3.eth.Contract(swapABI, config.vntSwapAddress);
        vntToken = new web3.eth.Contract(tokenABI, config.vntTokenAddress);
        usdtToken = new web3.eth.Contract(tokenABI, config.usdtTokenAddress);
        
        minSellAmount = await swapContract.methods.minSell().call();
        vntDecimals = await vntToken.methods.decimals().call();
        usdtDecimals = await usdtToken.methods.decimals().call();
        
        document.getElementById('minSellAmount').textContent = formatUnits(minSellAmount, vntDecimals) + ' VNT';
        
        await loadContractData();
    } catch (error) {
        showMessage(`Error initializing contracts: ${error.message}`, 'error');
    }
}

async function loadContractData() {
    try {
        const price = await swapContract.methods.getPricePerVNT().call();
        document.getElementById('vntPrice').textContent = `${formatUnits(price, 18)} USDT`;
        
        document.getElementById('vntContract').textContent = await swapContract.methods.vntToken().call();
    } catch (error) {
        showMessage(`Error loading contract data: ${error.message}`, 'error');
    }
}

async function checkApprovalStatus(vntAmount) {
    try {
        if (!vntAmount || web3.utils.toBN(vntAmount).lt(web3.utils.toBN(minSellAmount))) {
            return false;
        }
        
        const currentAllowance = await vntToken.methods.allowance(
            currentAccount, 
            CONFIG.mainnet.vntSwapAddress
        ).call();
        
        return web3.utils.toBN(currentAllowance).gte(web3.utils.toBN(vntAmount));
    } catch (error) {
        console.error('Approval check error:', error);
        return false;
    }
}

async function approveVNT() {
    try {
        const vntAmountInput = document.getElementById('vntAmount').value;
        if (!vntAmountInput || isNaN(vntAmountInput)) {
            showMessage('Please enter a valid VNT amount', 'error');
            return;
        }
        
        const vntAmount = toTokenUnits(vntAmountInput, vntDecimals);
        
        if (vntAmount.lt(web3.utils.toBN(minSellAmount))) {
            showMessage(`Minimum sale is ${formatUnits(minSellAmount, vntDecimals)} VNT`, 'error');
            return;
        }
        
        await handleTransaction(
            vntToken.methods.approve(
                CONFIG.mainnet.vntSwapAddress,
                vntAmount.toString()
            ).send({ from: currentAccount }),
            'VNT approved successfully!'
        );
        
        document.getElementById('approveBtn').disabled = true;
        document.getElementById('sellBtn').disabled = false;
    } catch (error) {
        if (error.code === 4001) {
            showMessage('User rejected transaction', 'error');
        } else {
            showMessage(`Approval failed: ${error.message}`, 'error');
        }
    }
}

async function sellVNT() {
    try {
        const vntAmountInput = document.getElementById('vntAmount').value;
        if (!vntAmountInput || isNaN(vntAmountInput)) {
            showMessage('Please enter a valid VNT amount', 'error');
            return;
        }
        
        const vntAmount = toTokenUnits(vntAmountInput, vntDecimals);
        
        if (vntAmount.lt(web3.utils.toBN(minSellAmount))) {
            showMessage(`Minimum sale is ${formatUnits(minSellAmount, vntDecimals)} VNT`, 'error');
            return;
        }
        
        await handleTransaction(
            swapContract.methods.sellVNT(vntAmount.toString()).send({ from: currentAccount }),
            'VNT sold successfully!'
        );
        
        await loadContractData();
        updateUI();
    } catch (error) {
        if (error.code === 4001) {
            showMessage('User rejected transaction', 'error');
        } else {
            showMessage(`Sale failed: ${error.message}`, 'error');
        }
    }
}

async function handleTransaction(transactionPromise, successMessage) {
    try {
        showMessage('Processing transaction...', 'status');
        await transactionPromise;
        showMessage(successMessage, 'success');
    } catch (error) {
        throw error;
    }
}

function copyContractAddress() {
    const address = document.getElementById('vntContract').textContent;
    navigator.clipboard.writeText(address);
    showMessage('Contract address copied!', 'success');
}

function updateUI() {
    const isConnected = currentAccount !== null;
    document.getElementById('connectWalletBtn').textContent = isConnected ? 'Connected' : 'Connect Wallet';
    document.getElementById('walletInfo').classList.toggle('hidden', !isConnected);
    
    document.getElementById('approveBtn').disabled = !isConnected;
    document.getElementById('sellBtn').disabled = true;
}

function formatUnits(value, decimals) {
    return (value / 10 ** decimals).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: decimals
    });
}

function shortenAddress(address) {
    return address ? `${address.substring(0, 6)}...${address.substring(address.length - 4)}` : '';
}

function showMessage(message, type = 'status') {
    const statusDiv = document.getElementById('statusMessages');
    const messageElement = document.createElement('div');
    messageElement.textContent = message;
    messageElement.classList.add(`${type}-message`);
    statusDiv.appendChild(messageElement);
    setTimeout(() => messageElement.remove(), 5000);
}
