const http = require('http');
http.createServer(function(req, res){
    res.write("OK");
    res.end();
}).listen(8080);

const axios = require("axios");
const FormData = require("form-data");
const { Readable } = require("stream");
const WebSocket = require("ws");
const vm = require("vm");

let usercode = {};
let channelwebhook = {};
axios
  .get(
    "https://discord.com/api/v10/channels/1365678304941703219/messages?limit=1",
    {
      headers: {
        Authorization: `Bot ${process.env.token}`,
      },
    }
  )
  .then((response) => {
    axios.get(response.data[0].attachments[0].url).then((response) => {
      usercode = response.data;
    });
    axios.get(response.data[0].attachments[1].url).then((response) => {
      channelwebhook = response.data;
    });
  });
let ws;
let heartbeatInterval;
function connect(){
  ws = new WebSocket("wss://gateway.discord.gg/?v=10&encoding=json");
  ws.on("message", (data) => {
    const buffer = Buffer.from(data);
    const jsonString = buffer.toString("utf8");
    const jsonObject = JSON.parse(jsonString);
    if (jsonObject.op === 10) {
      const interval = jsonObject.d.heartbeat_interval;
      heartbeatInterval = setInterval(() => {
        ws.send(JSON.stringify({ op: 1, d: null }));
        ws.send(
          JSON.stringify({
            op: 3,
            d: {
              since: null,
              activities: [
                {
                  name: `test`,
                  type: 0,
                },
              ],
              status: "online",
              afk: false,
            },
          })
        );
      }, interval);
  
      ws.send(
        JSON.stringify({
          op: 2,
          d: {
            token: process.env.token,
            intents: 131071,
            properties: {
              $os: process.platform,
              $browser: "Pasta Bot",
              $device: "Pasta Bot",
            },
          },
        })
      );
    }
    if (jsonObject.t === "MESSAGE_CREATE") {
      const data = jsonObject.d;
      if (data.author.id !== "1365619295911936141") {
        for (const userId in usercode) {
          let send = true;
          try {
            const result = vm.runInNewContext(
              usercode[userId].message,
              {
                content: data.content,
                channel_id: data.channel_id,
                message: (channel, embed) => {
                  if (send) {
                    if (!(channel in channelwebhook)) {
                      axios.post(
                        `https://discord.com/api/v10/channels/${channel}/webhooks`,
                        {
                          "name": "Pasta Bot",
                          "avatar": "https://cdn.discordapp.com/avatars/1168518869992869970/193ae9bf7ca8e32ca3d1a5b07b244e03"
                        },
                        {
                          headers: {
                            Authorization: `Bot ${process.env.token}`,
                            "Content-Type": "application/json",
                          },
                        }
                      ).then((response) => {
                        channelwebhook[channel] = {id: response.data.id, token: response.data.token};
                      })
                      .catch((error) => {
                      });
                    }else{
                      axios.post(
                        `https://discord.com/api/v10/webhooks/${channelwebhook[channel].id}/${channelwebhook[channel].token}`,
                        { embeds: [embed] },
                        {
                          headers: {
                            Authorization: `Bot ${process.env.token}`,
                            "Content-Type": "application/json",
                          },
                        }
                      );
                    }
                    send = false;
                  }
                },
              },
              { timeout: 100 }
            );
          } catch (e){
          }
        }
      }
    }
    if (jsonObject.t === "INTERACTION_CREATE") {
      const data = jsonObject.d;
      const userId = data.member.user.id;
      if (data.data.custom_id?.startsWith("code_")) {
        const event = data.data.custom_id.split("_")[1];
        if (!(userId in usercode)) {
          usercode[userId] = { message: "" };
        }
        const code = data.data.components[0].components[0].value;
        usercode[userId][event] = code;
        axios.post(
          `https://discord.com/api/v10/interactions/${data.id}/${data.token}/callback`,
          {
            type: 4,
            data: {
              embeds: [
                {
                  title: event,
                  description: code,
                  color: 0xffa500,
                },
              ],
            },
          },
          {
            headers: {
              Authorization: `Bot ${process.env.token}`,
              "Content-Type": "application/json",
            },
          }
        );
      }
      if (data.data.name === "code") {
        axios.post(
          `https://discord.com/api/v10/interactions/${data.id}/${data.token}/callback`,
          {
            type: 9,
            data: {
              title: "コードを入力",
              custom_id: `code_${data.data.options[0].value}`,
              components: [
                {
                  type: 1,
                  components: [
                    {
                      type: 4,
                      custom_id: "text",
                      label: "Code",
                      style: 2,
                      min_length: 0,
                      max_length: 1000,
                      placeholder: "",
                      required: false,
                    },
                  ],
                },
              ],
            },
          },
          {
            headers: {
              Authorization: `Bot ${process.env.token}`,
              "Content-Type": "application/json",
            },
          }
        );
      }
    }
  });
  ws.on("close", (data) => {
    clearInterval(heartbeatInterval);
    setTimeout(connect, 5000);
  });
}
connect();
setInterval(async () => {
  const form = new FormData();

  form.append("file1", Readable.from([JSON.stringify(usercode)]), {
    filename: "usercode.json",
    contentType: "application/json",
  });
  form.append("file2", Readable.from([JSON.stringify(channelwebhook)]), {
    filename: "channelwebhook.json",
    contentType: "application/json",
  });

  try {
    const response = await axios.post(
      `https://discord.com/api/v10/channels/1365678304941703219/messages`,
      form,
      {
        headers: {
          Authorization: `Bot ${process.env.token}`,
          ...form.getHeaders(),
        },
      }
    );
  } catch (error) {
    console.error(error);
  }
}, 1000 * 60 * 15);
