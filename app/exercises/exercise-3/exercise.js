// Exercise 3: Belongs to association
import { Server, Model, RestSerializer } from "miragejs";

export default function makeServer() {
  return new Server({
    serializers: { application: RestSerializer },

    models: {
      user: Model
    },

    seeds(server) {
      server.create("user", { name: "Sam" });
      server.create("user", { name: "Ryan" });
    },

    routes() {
      this.resource("user");
    }
  });
}
