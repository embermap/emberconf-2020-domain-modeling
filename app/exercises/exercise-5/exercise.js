// Exercise 5: Fetching a graph, server-side driven
import { Server, Model, RestSerializer, belongsTo } from "miragejs";

export default function makeServer() {
  return new Server({
    serializers: {
      application: RestSerializer,
      message: RestSerializer.extend({
        serialize() {
          debugger;
        }
        // include: ["user"],
        // embed: true
      })
    },

    models: {
      user: Model,

      message: Model.extend({
        user: belongsTo()
      })
    },

    seeds(server) {
      let sam = server.create("user", { name: "Sam" });
      let ryan = server.create("user", { name: "Ryan" });

      server.create("message", { user: ryan, text: "hey!" });
      server.create("message", { user: sam, text: "hey man" });
      server.create("message", {
        user: ryan,
        text: "hows #coronaconf2020 going?"
      });
      server.create("message", {
        user: sam,
        text: " managed to buy groceries but somehow all I'm eating is candy"
      });
    },

    routes() {
      this.resource("user");
      this.resource("message");
    }
  });
}

// Exercise 4: Fetching a graph, server-side
// import { Server, Model, RestSerializer, belongsTo } from "miragejs";

// export default function makeServer() {
//   return new Server({
//     serializers: { application: RestSerializer },

//     models: {
//       user: Model,

//       message: Model.extend({
//         user: belongsTo()
//       })
//     },

//     seeds(server) {
//       let sam = server.create("user", { name: "Sam" });
//       let ryan = server.create("user", { name: "Ryan" });

//       server.create("message", { text: "Hello!", user: sam });
//       server.create("message", { text: "hey sam whats up", user: ryan });
//       server.create("message", {
//         text: "nm just chillen at #coronoconf2020",
//         user: sam
//       });
//       server.create("message", { text: "true. true.", user: ryan });
//     },

//     routes() {
//       this.resource("user");
//       this.resource("message");
//     }
//   });
// }
