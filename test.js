const testApi = async () => {
    try {
        const fetchRes = await fetch("https://gift-card-balance-api.onrender.com/api/checkBalance?cardNumber=1006770147949188&pin=194374");
        console.log("Status:", fetchRes.status);
        const data = await fetchRes.text();
        console.log("Response:", data);
    } catch (e) {
        console.error("Error:", e);
    }
}
testApi();
