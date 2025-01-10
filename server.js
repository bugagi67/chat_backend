const http = require("http");
const Koa = require("koa");
const koaBody = require("koa-body");
const WS = require("ws");
const Router = require("koa-router");
const moment = require("moment");
moment.locale('ru');

const app = new Koa();
const router = new Router();

const users = {};
const messageHistory = [];

router.get('/', (ctx) => {
	ctx.body = "Сервер запущен";
})

app.use(
  koaBody({
    urlencoded: true,
  }),
);

app.use(router.routes()).use(router.allowedMethods());

const port = process.env.PORT || 7070;
const server = http.createServer(app.callback());

const wss = new WS.Server({
  server,
});

const sendUserList = () => {
  userList = Object.keys(users);
  const message = JSON.stringify({ type: "user-list", users: userList });
  userList.forEach((nickname) => {
    users[nickname].send(message);
  });
};

wss.on("connection", (ws) => {
  let currentNickName = "";


  ws.on("message", (data) => {
    const message = JSON.parse(data);

    switch (message.type) {
      case "set_nickname": {
        const { nickname } = message;
        if (!nickname || users[nickname]) {
          ws.send(
            JSON.stringify({
              type: "nickname_error",
              message: "Никнейм уже занят",
            }),
          );
        } else {
          currentNickName = nickname;
          users[nickname] = ws;

          ws.send(JSON.stringify({ type: "message_history", messages: messageHistory}));
          ws.send(JSON.stringify({ type: "nickname_accepted", nickname }));
          sendUserList();
        }

        break;
      }

      case "send_message": {
        const { content } = message;
        const timestamp = moment().format('HH:mm DD.MM.YYYY');

        const outgoingMessage = JSON.stringify({
          type: "new_message",
          sender: currentNickName,
          timestamp,
          content,
        });

        messageHistory.push({sender: currentNickName, content, timestamp });
      
        if (messageHistory.length > 100) {
          messageHistory.shift();
        }

        Object.values(users).forEach((client) => {
          client.send(outgoingMessage);
        });
        break;
      }
    }
  });

  ws.on("close", () => {
    if (currentNickName) {
      delete users[currentNickName];
      sendUserList();
    }
  });
});

server.listen(port, () => {
  console.log(`http://localhost:${port}`);
});
