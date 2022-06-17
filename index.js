const { Client } = require("matrix-org-irc");
const fetch = require("node-fetch");

require('dotenv').config();

function updateIRCTopic(open) {
    const client = new Client(process.env.IRC_SERVER_HOSTNAME, process.env.IRC_CLIENT_NICKNAME, {
        port: Number(process.env.IRC_SERVER_PORT || 6697),
        secure: true,
        sasl: true,
        userName: process.env.IRC_CLIENT_SASL_USERNAME,
        password: process.env.IRC_CLIENT_SASL_PASSWORD,
        realName: process.env.IRC_CLIENT_REALNAME,
        channels: [process.env.IRC_TARGET_CHANNEL],
        autoConnect: true,
        debug: true
    });

    const IRC_TOPIC_MESSAGE_PATTERN = new RegExp(process.env.IRC_TOPIC_MESSAGE_PATTERN);

    client.on("topic", async (channel, topic) => {
        console.info(`Topic for ${channel} is "${topic}"`);

        if (channel !== process.env.IRC_TARGET_CHANNEL) return;

        let newTopic;
        if (IRC_TOPIC_MESSAGE_PATTERN.test(topic)) {
            newTopic = topic.replace(IRC_TOPIC_MESSAGE_PATTERN, open ? process.env.IRC_TOPIC_MESSAGE_OPEN : process.env.IRC_TOPIC_MESSAGE_CLOSED);
        } else {
            newTopic = `${topic} | ${open ? process.env.IRC_TOPIC_MESSAGE_OPEN : process.env.IRC_TOPIC_MESSAGE_CLOSED}`;
        }

        if (topic !== newTopic) {
            console.info(`Setting topic to "${newTopic}"`);
            await client.say("ChanServ", `TOPIC ${channel} ${newTopic}`);
        } else {
            client.disconnect();
        }
    });

    // automatically disconnect after 1 minute in case something happens
    setTimeout(() => { client.disconnect(); }, 60 * 1000);
}

let lastChange = 0;

async function checkForStateChange() {
    try {
        console.debug("Fetching SpaceAPI");
        const json = await fetch(process.env.SPACEAPI_URL).then(res => res.json());
        console.debug("Got JSON response from SpaceAPI");

        if (lastChange && json.state.lastchange > lastChange) {
            console.info("Status changed, updating IRC topic");
            updateIRCTopic(json.state.open);
        }

        lastChange = json.state.lastchange;
        console.debug(`Last change is now ${lastChange}`);
    } catch (e) {
        console.error(e);
    }
}

console.info("Starting...");
setInterval(checkForStateChange, 3 * 60 * 1000);
checkForStateChange();
