# Mahjong Match & League App — PRD

## Goal
Create a simple, mobile-friendly app for a private mahjong group. Members should be able to organize games, join available matches, manage their schedules, enter scores, and view standings. The app should also support paid seasonal leagues.

## Core Member Features

### Profiles
Members create a short profile with:
* Name
* Optional photo
* Email and optional phone number
* Town
* Experience level
* Registration can be invite-only.

### Propose a Match
A member posts:
* Date and time
* Venue and location
* Optional notes
* Whether supplies are provided
* The host automatically takes one of four seats. Up to three other members can join.

### Browse and Join Matches
Members can scroll through upcoming matches and filter by:
* Date or day
* Time
* Location
* Open or full
* Scramble or league
* Members can join an open match or leave if their schedule changes. A match closes when four players are registered.

### My Matches
Members can view:
* Upcoming matches
* Completed matches
* Matches they are hosting
* Each match should show the venue, players, notes, and status.

### Match Communication
Players should receive updates when:
* Someone joins or leaves
* Match details change
* A match is canceled
* Scores are entered
* *Note: A simple match-based message thread would be helpful, but email notifications or a group-text link could work for the first version.*

### Scores and Leaderboard
After a match, the host or scorekeeper enters each player’s final score.
The app should:
* Save the scores with the correct players
* Show completed results
* Allow the administrator to correct errors
* Update one main leaderboard automatically
* *Note: The exact leaderboard formula still needs to be decided.*

## League Features
The administrator should be able to create a recurring league with:
* Name and description
* Weekly day and time
* Venue
* Start date and number of weeks
* Capacity
* Registration fee
* Scoring rules
* Prize information
* Members should be able to view the league, register, pay through Stripe, see the schedule, and view standings.
* *Note: For the first version, table assignments, substitutes, and payment tracking can be handled manually.*

## Administrator Features
The administrator should be able to:
* Manage members
* Edit or cancel any match
* Add or remove players
* Correct scores
* Create and manage leagues
* Track registrations and payments
* Send announcements
* Export data

## MVP Priority
The first version should support this complete workflow:
1. Member signs in.
2. Member proposes a match.
3. Other members browse and join.
4. Match closes at four players.
5. Members can view or leave the match.
6. Host enters scores.
7. Completed match appears in history.
8. Leaderboard updates.

*Waitlists, advanced messaging, automated payments, push notifications, and native app-store distribution can come later.*
