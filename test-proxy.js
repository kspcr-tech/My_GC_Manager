const testProxy = async () => {
    try {
        const url = encodeURIComponent("https://gift-card-balance-api.onrender.com/api/checkBalance?cardNumber=1006770147949188&pin=194374");
        const fetchRes = await fetch("http://127.0.0.0:3000/api/proxyCheckBalance?url=" + url);
        console.log("Status:", fetchRes.status);
        const data = await fetchRes.text();
        console.log("Response:", data);
    } catch (e) {
        console.error("Error:", e);
    }
}
testProxy();
