import {
  Server,
  Model,
  Factory,
  hasMany,
  belongsTo,
  JSONAPISerializer
} from "miragejs";
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

    serializers: {
      application: JSONAPISerializer
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
      server.createList("message", 10, { user });
    },

    routes() {
      this.resource("user");
      this.resource("message");
    }
  });
}
