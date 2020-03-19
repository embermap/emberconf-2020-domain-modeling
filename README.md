# EmberConf 2020: Domain Modeling with Mirage JS

## Intro

In most web apps, the database is the source of truth.

As frontend developers we often don't have to deal directly with it. But we do need to understand enough about our server resources to be able to do our job.

- In traditional SSR, user fetches HTML (wikipedia page). Is it stale? How does user know? cmd+R to reload
- Does it work? Often yes. The model is very simple.
- But can you build Slack with it?
- Ideally, User shouldn’t be responsible for whether they’re looking at fresh data. Think about iMessages or text messaging. Push vs. pull.
- This is the power that JS gives us.
- Keeping our UIs updated means we need to be intelligent about what data we fetch on our user’s behalf, as well as when we fetch it.
- Sometimes we want to push all new data. In Slack, you get a message, server should push message up to client + UI re-renders
- Other times, we want to render from cache. If you open Mail app on Mac or your phone, you have all your recent messages locally. If you get a new email you want to see it, but if you click back and forth between messages you should read them instantly, even if network is down. Want to render from cache.
- All of this motivates the question of how best to get data from our servers to our frontends, which is where domain modeling comes into play.

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

---

## Exercise n: Fetching a graph, client-side query

In the last exercise the server made the choice about what related data to include in the response. Sometimes this makes sense, but in recent years tools like JSON:API and GraphQL have shifted the control to the client.

Let's look at a JSON:API backend.

[ Fetch messages ][ fetch messages with their users ]

**Q:** Does JSON:API product normalized or denormalized data?

# Exercise n

# Exercise n

- New server resources just for frontend
  - DHH talk: Resources On Rails
  - EmberMap bookshelves

# Exercise n

- Materialized views

  - Difference between post.comments.length and post.commentsCount
  - Both become stale once fetched on client. What’s the difference?

- Client-side identity

- UI drives your server’s domain modeling

- Backend For a Frontend (BFF)

## More learning resources

- [DHH talk Resources on Rails]()
- [Backend for a frontend article Fowler]()
