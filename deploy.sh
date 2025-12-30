APP_NAME="fauno_backend"

if pm2 describe $APP_NAME > /dev/null; then
    echo "Stopping existing process..."
    pm2 stop $APP_NAME
    pm2 delete $APP_NAME
fi

echo "Starting new $APP_NAME process"
NODE_ENV=production pm2 start "npm run start" --name $APP_NAME --watch

pm2 save
