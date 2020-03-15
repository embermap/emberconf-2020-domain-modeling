import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { action } from "@ember/object";

export default class extends Component {
  @tracked activeTableName = this.tableNames[0];

  @action
  setActiveTableName(tableName) {
    this.activeTableName = tableName;
  }

  get db() {
    return this.args.server.db.dump();
  }

  get tableNames() {
    return Object.keys(this.db);
  }

  get records() {
    return this.db[this.activeTableName];
  }

  get fields() {
    let fields = this.records[0] ? Object.keys(this.records[0]) : [];

    return fields.sort((a, b) => {
      if (a === "id") {
        return -1;
      }
      if (b === "id") {
        return -1;
      }
    });
  }

  get rows() {
    return this.records.map(record => {
      return { attrs: this.fields.map(field => record[field]) };
    });
  }
}
