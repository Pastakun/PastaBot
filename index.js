const http = require("http");
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
      for (const userId in usercode) {
        if(typeof usercode[userId].message === "string"){
          usercode[userId].message = ["", "", "", "", ""];
        }
      }
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
      if (!data.author.bot) {
        for (const userId in usercode) {
          let send = true;
          try {
            const result = vm.runInNewContext(
              usercode[userId].message.join("\n"),
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
                          "avatar": "data:image/png;base64,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"
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
                        console.error(error);
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
                      ).then((response) => {
                      }).catch((error) => {
                        console.error(error);
                      });
                    }
                    send = false;
                  }
                },
              },
              { timeout: 3000 }
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
        const code = [data.data.components[0].components[0].value, data.data.components[1].components[0].value, data.data.components[2].components[0].value, data.data.components[3].components[0].value, data.data.components[4].components[0].value];
        usercode[userId][event] = code;
        axios.post(
          `https://discord.com/api/v10/interactions/${data.id}/${data.token}/callback`,
          {
            type: 4,
            data: {
              embeds: [
                {
                  title: "設定しました。",
                  description: event,
                  color: 0xffa500,
                },
                {
                  description: `\`\`\`js
                  ${code[0]}
                  \`\`\``,
                  color: 0xffa500,
                },
                {
                  description: `\`\`\`js
                  ${code[1]}
                  \`\`\``,
                  color: 0xffa500,
                },
                {
                  description: `\`\`\`js
                  ${code[2]}
                  \`\`\``,
                  color: 0xffa500,
                },
                {
                  description: `\`\`\`js
                  ${code[3]}
                  \`\`\``,
                  color: 0xffa500,
                },
                {
                  description: `\`\`\`js
                  ${code[4]}
                  \`\`\``,
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
        if (!(userId in usercode)) {
          usercode[userId] = { message: ["", "", "", "", ""] };
        }
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
                      custom_id: "text1",
                      label: "Code 1",
                      style: 2,
                      min_length: 0,
                      max_length: 4000,
                      placeholder: "",
                      required: false,
                      value: usercode[userId][data.data.options[0].value][0]
                    },
                  ],
                },
                {
                  type: 1,
                  components: [
                    {
                      type: 4,
                      custom_id: "text2",
                      label: "Code 2",
                      style: 2,
                      min_length: 0,
                      max_length: 4000,
                      placeholder: "",
                      required: false,
                      value: usercode[userId][data.data.options[0].value][1]
                    },
                  ],
                },
                {
                  type: 1,
                  components: [
                    {
                      type: 4,
                      custom_id: "text3",
                      label: "Code 3",
                      style: 2,
                      min_length: 0,
                      max_length: 4000,
                      placeholder: "",
                      required: false,
                      value: usercode[userId][data.data.options[0].value][2]
                    },
                  ],
                },
                {
                  type: 1,
                  components: [
                    {
                      type: 4,
                      custom_id: "text4",
                      label: "Code 4",
                      style: 2,
                      min_length: 0,
                      max_length: 4000,
                      placeholder: "",
                      required: false,
                      value: usercode[userId][data.data.options[0].value][3]
                    },
                  ],
                },
                {
                  type: 1,
                  components: [
                    {
                      type: 4,
                      custom_id: "text5",
                      label: "Code 5",
                      style: 2,
                      min_length: 0,
                      max_length: 4000,
                      placeholder: "",
                      required: false,
                      value: usercode[userId][data.data.options[0].value][4]
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
