import { Server, Model, Factory, hasMany, belongsTo } from "miragejs";
import faker from "faker";

export default function makeServer() {
  return new Server({
    models: {
      user: Model.extend({
        messages: hasMany()
      }),
      message: Model.extend({
        user: belongsTo()
      })
    },

    factories: {
      message: Factory.extend({
        text() {
          return faker.lorem.sentence();
        }
      })
    },

    seeds(server) {
      let user = server.create("user", { name: "Sam" });
      server.createList("message", 20, { user });
    },

    routes() {
      this.namespace = "api";

      this.resource("user");
      this.resource("message");
    }
  });
}
