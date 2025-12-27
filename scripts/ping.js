
// Standalone script to ping the server
// Usage: node scripts/ping.js <URL>

const url = process.argv[2] || process.env.APP_URL;

if (!url) {
    console.error("❌ Please provide a URL as an argument or set APP_URL env var.");
    process.exit(1);
}

const target = url.endsWith('/ping') ? url : `${url}/ping`;

console.log(`📡 Pinging ${target}...`);

fetch(target)
    .then(res => {
        if (res.ok) {
            console.log(`✅ Success! Status: ${res.status}`);
        } else {
            console.error(`❌ Failed! Status: ${res.status}`);
            process.exit(1);
        }
    })
    .catch(err => {
        console.error(`❌ Error: ${err.message}`);
        process.exit(1);
    });
