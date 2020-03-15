import Component from "@glimmer/component";
import { guidFor } from "@ember/object/internals";

export default class extends Component {
  id = guidFor(this);

  get isActive() {
    return this.args.activePanelId === this.id;
  }
}
