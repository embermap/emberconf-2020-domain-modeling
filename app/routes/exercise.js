import Route from "@ember/routing/route";
import { scheduleOnce } from "@ember/runloop";
import { set } from "@ember/object";
import configs from "../exercises";

export default class extends Route {
  model({ step }) {
    if (window.server) {
      window.server.shutdown();
    }

    let server = configs[step]();
    window.server = server;
    return server;
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
