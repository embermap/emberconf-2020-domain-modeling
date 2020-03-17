import { Server, Model, belongsTo, hasMany } from "miragejs";

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

    seeds(server) {
      let sam = server.create("user", { name: "Sam" });
      let ryan = server.create("user", { name: "Ryan" });

      sam.createMessage({ text: "hey!" });
      ryan.createMessage({ text: "hey man" });
      ryan.createMessage({ text: "hows #coronaconf2020 going?" });
      sam.createMessage({
        text: "I managed to buy groceries but somehow all I'm eating is candy"
      });
    },

    routes() {
      this.get("/movies", () => {
        return {
          movies: [
            { id: 1, name: "Inception", year: 2010 },
            { id: 2, name: "Interstellar", year: 2014 },
            { id: 3, name: "Dunkirk", year: 2017 }
          ]
        };
      });
    }
  });
}
