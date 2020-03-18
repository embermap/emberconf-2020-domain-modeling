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

[ Replace the 5 routes with the resource shorthand ]

## Exercise 3: Fetching a graph, server-side default includes

How might we render list of messages in Discord? We need the users' name next to each message.

[ Add include ]

The default is to **sideload** the related data. Sideloading produces **normalized data**.

Click on the database tab. You can see that the query is really fetching a _snapshot_ of the database.

Now set `embed: true` in your serializer.

[ Set embed: true ]

This data is **denormalized**. You can see duplicated information when compared to our db.

You might hear this referred to as a **materialized view** of the database.

Now, let's say we wanted to build a screen for a user, and show their recent messages. How might we get the data?

[ **Exercise:** Fetch the user and their messages ]

## Exercise 4: Fetching a graph, client-side query

In the last exercise the server made the choice about what related data to include in the response. Sometimes this makes sense, but in recent years tools like JSON:API and GraphQL have shifted the control to the client.

Let's look at a JSON:API backend.

[ Fetch messages ][ fetch messages with their users ]

**Q:** Does JSON:API product normalized or denormalized data?

# Exercise 5

# Exercise n

- New server resources just for frontend
  - DHH talk: Resources On Rails
  - EmberMap bookshelves

# Exercise n

- Materialized views
  - Difference between post.comments.length and post.commentsCount
  - Both become stale once fetched on client. What’s the difference?

## Further learning resources

- [DHH talk Resources on Rails]()
