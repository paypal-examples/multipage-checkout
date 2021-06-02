const ngrok = require("ngrok");
const axios = require("axios");
const dotenv = require("dotenv");
const chalk = require("chalk");

dotenv.config();

const { PAYPAL_API_BASE, CLIENT_ID, CLIENT_SECRET } = process.env

const { getAccessToken } = require("../server/oauth");

(async function () {
  if(!CLIENT_ID || !CLIENT_SECRET){
    console.log("[Error] missing CLIENT_ID, CLIENT_SECRET from .env file")
    process.exit(1);
  }

  let proxyURL

  try {
    proxyURL = await ngrok.connect(8080);
  } catch(err){
    console.log(err)
    console.log(`[Error] ngrok failed to connect`);
    process.exit(1);
  }

  try {
    const { access_token } = await getAccessToken();

    // Create a webhook to the proxy url
    const { data } = await axios({
      url: `${PAYPAL_API_BASE}/v1/notifications/webhooks`,
      method: "post",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${access_token}`,
      },
      data: {
        url: proxyURL + "/webhook", // FIXME: make dynamic
        event_types: [
          {
            name: "CHECKOUT.ORDER.APPROVED",
          },
        ],
      },
    });

    console.log(`${chalk.blue("Forwarding webhooks to http://localhost:8080/webhook")} `, "\n", 
    `webhooks can take upto 5 min to process after authorization`, "\n", 
     "\n", "\n",
    `${chalk.yellow("Webhook Id:")} ${data.id}`, "\n",
    "(^C to quit)",
    )

    // on terminal shutdown - delete the webhook
    process.on("SIGINT", async () => {
      const { id } = data;

      await axios({
        url: `${PAYPAL_API_BASE}/v1/notifications/webhooks/${id}`,
        method: "delete",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${access_token}`,
        },
      });

      process.exit(1);
    });
  } catch (err) {
    console.error(err);
  }
})();