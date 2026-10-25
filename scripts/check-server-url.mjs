// The Android app is a shell around a running Paalam server, so it must know where that is.
const url = process.env.PAALAM_SERVER_URL;
if (!url || !/^https?:\/\/[^\s/]+/.test(url)) {
  console.error(`
PAALAM_SERVER_URL isn't set. The Android app loads Paalam from your server, so tell it where:

  Hosted (recommended):   PAALAM_SERVER_URL=https://paalam-xxxxx.a.run.app npm run android:apk
  Same Wi-Fi (testing):   PAALAM_SERVER_URL=http://192.168.1.20:8080 npm run android:apk
                          (your computer's address on the network; run "npm start" there first)
`);
  process.exit(1);
}
console.log(`Android app will load Paalam from ${url}`);
