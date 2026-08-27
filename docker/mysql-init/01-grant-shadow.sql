-- Allow Prisma migrate dev to create temporary shadow databases.
GRANT ALL PRIVILEGES ON *.* TO 'workally'@'%' WITH GRANT OPTION;
FLUSH PRIVILEGES;
