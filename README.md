# EmberConf 2020: Domain Modeling with Mirage JS

## Intro

In most web apps, the database is the source of truth.

As frontend developers we often don't have to deal directly with it. But we do need to understand enough about our server resources to be able to do our job.

Traditional SSR has the luxury of getting to speak directly to the database (the source of truth) on every request. But SSR can't build rich experiences on the web, like Slack or Google Calendar.

These types of JS apps - like the apps we build with Ember - must grapple with the fact that the source of truth is remote, and requires a network call to communicate with.

All of this motivates the question of how best to get data from our servers to our frontends, which is where domain modeling comes into play.

## Exercise 1: Getting familiar with the inspector

Explore the inspector

## Exercise 2: Models, the database and CRUD

Resources vs. database records.

[ Add Model ]

[ Add seeds ]

[ Replace the 5 routes with the resource shorthand ]

## Exercise 3: Practice creating a model

Let's add another model, called a Message.

Messages look like

```js
let message = {
  text: "hello emberconf!"
};
```

Define a Message model and create some messages in `seeds`. Add a resource to routes. Explore them in the database tab and make requests to them from the client.

## Exercise 4: Belongs to association

Where should we store message data?

[ Make a new Message model]

How can we associate these two things? Using a _foreign key_.

[ Make a belongsTo relationship ]

Mirage's ORM helps manage foreign keys for us, just like most backend systems.

## Exercise 5: Practice creating a belongs to association

Users can also have activities.

Create a new activity model, associate it with a user, and create some activities for the user.

A sample activity looks like this:

```js
let activity = {
  userId: 1,
  kind: "mention" // upload, reaction
};
```

[ **Exercise:** Create activity ]

Try deleting a user! What happens to the associated messages and activites?

## Exercise 6: Has many association

The other association type is a Has Many.

Let's go back to just having users and messages that are unassociated.

Instead of associating the user with the message, we can associate the messages with the user.

[ Add user.messages hasMany association ]

## Exercise 7: One to many association

So far we've seen one-way relationships. Mirage (and most backend systems) support two-way relationships, or relationships that have an _inverse_.

Let's make user and messages a one-to-many relationship.

[ Add user.messages and message.users ]

Notice how Mirage keeps the fks in sync, regardless of which side you edit.

## Exercise 8: Fetching a graph, server driven

Alright - now that we have our data modeled in our database, it's time to fetch it. But how can our client best fetch it?

Let's say we're building Slack and we want to display a list of messages. Need to show the message and author for each message.

[ Fetch /messages. Fetch /users. ]

Could fetch separately and then stitch.

We want to enable our clients to fetch a _graph_ of data in one request.

[ Define message serializer, add include ]

The default is to **sideload** the related data. Sideloading produces **normalized data**.

[ Set embed: true ]

This data is **denormalized**. You can see duplicated information when compared to our db.

You might hear this referred to as a **materialized view** of the database.

## Exercise 9: Practice with includes and embed

Now, let's say we wanted to build a screen for a single user, and show them all their messages. How might we get the data? What would the query be?

[ **Exercise:** Fetch the user and their messages ]

Did you go with embedded or sideloaded? Was there data duplication?

## Exercise 10: Fetching a graph, client-side query

In the last exercise the server made the choice about what related data to include in the response. Sometimes this makes sense, but in recent years tools like JSON:API and GraphQL have shifted the control to the client.

Let's look at a JSON:API backend.

[ Fetch messages ]

[ Fetch messages with their users ]

**Q:** Does JSON:API produce normalized or denormalized data?

Putting power in the client keeps the server more flexible + able to support more UI use cases.

...sound familiar?

## Exericse 11: Fetching a graph with GraphQL

Schema. Our domain modeling is the same. No more serializer. One route handler.

So, it's like JSON:API, but often will produce denormalized data. Hyperfocused on being suitable for the particular view. Completely generalized.

**Q:** What are some of the pros/cons of normalized vs. denormalized data? (Client-side identity)

## Exericse 12: Many to many

Ok, circling back to some more domain modeling. Let's look at another type of relationship.

**Q:** How should we associate users to channels?

[ Add user.channels and channel.users ]

Notice how the arrays of foreign keys stay in sync.

## Exercise 13: Many to many: the join record

How might the client add and remove users to channels?

[ Send PATCH removing Sam from a channel ]

Alternatives?

[ New model ]

## Exercise 14: Practice with many to many joins

Time for some practice with joins. We want users to be able to be friends with each other.

One thing to know: if your relationship name doesn't match your model name, you can specify it like this:

```js
message: Model.extend({
  author: belongsTo("user")
});
```

Some keywords from this exercise: _inverse_, _self-reflexive_ relationships.

## Conclusion

Now you should know just enough about databases and server resources (without having to understand the details, like managing database indexes) to have a much better grasp on how data gets transferred between your frontend and backend.

The data layer is one of the most complex aspects of building a JavaScript app. Domain modeling - how you choose to store and relate your data - has **huge** ramifications for how much your app's complexity can scale as you add more features, and how clean (or not) your frontend code stays.

Data modeling is complex and there are definitely situations where experienced developers disagree over the correct data model. The best way to get better is with practice! You will develop an intuition for when it makes sense to introduce new resources to your system, and how best to relate those resources to your existing graph of models.

## More learning resources

- [DHH talk Resources on Rails](https://www.youtube.com/watch?v=GFhoSMD6idk)
- [The Back-end for Front-end Pattern (BFF)](https://philcalcado.com/2015/09/18/the_back_end_for_front_end_pattern_bff.html)
- [Pattern: Backends for Frontends](https://samnewman.io/patterns/architectural/bff/)
- [Turning the database inside out](https://www.youtube.com/watch?v=fU9hR3kiOK0)
