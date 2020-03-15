import Route from "@ember/routing/route";
import { scheduleOnce } from "@ember/runloop";
import { Server, Model, Factory, hasMany, belongsTo } from "miragejs";
import faker from "faker";
import { set } from "@ember/object";

function startMirage() {
  if (window.server) {
    window.server.shutdown();
  }

  window.server = new Server({
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
      server.createList("message", 10, { user });
    },

    routes() {
      this.namespace = "api";

      this.resource("user");
      this.resource("message");
    }
  });

  return window.server;
}

export default class extends Route {
  model() {
    return startMirage();
  }

  setupController(controller, model) {
    super.setupController(controller, model);
    set(controller, "show", false);
    scheduleOnce("afterRender", this, this.deferredWork);
  }

  deferredWork() {
    set(this.controller, "show", true);
  }
}
