## Run Procedure
To run locally, run the commands in Terminal/Command Prompt/Node.js in the project directory directly:

1. npm i
2. npm run db:init
3. npm run dev

then you can access the web application via the url link that is provided in the terminal.

## Trouble shooting

If the Database has been initialised previously with some content missing.

### Users section missing

run: npm run db:migrate:users

### Recurring tasks missing

run: npm run db:migrate:recur

## Seeding Data

### Creating User via Terminal

run: npm run db:seed:user

or to create personal one

run: npm run db:seed:user test@test.com Password123

### Seeding Example Tasks

run: npm run db:seed
