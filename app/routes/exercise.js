import Route from "@ember/routing/route";
import { scheduleOnce } from "@ember/runloop";
import { set } from "@ember/object";
import configs from "../exercises";

export default class extends Route {
  model({ exercise_slug }) {
    if (window.server) {
      window.server.shutdown();
    }

    let server = configs[exercise_slug]();
    window.server = server;
    return {
      server,
      exerciseSlug: exercise_slug
    };
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
