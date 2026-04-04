#!/usr/bin/env bash

# Function to safely push an env variable to vercel
push_env() {
    local key=$1
    local val=$2
    echo "Pushing $key..."
    # vercel env rm "$key" production preview development -y || true
    echo -n "$val" | npx vercel env add "$key" production preview development || true
}

push_env NEXT_PUBLIC_SUPABASE_URL "https://kykzwnghijedbjhdinlq.supabase.co"
push_env NEXT_PUBLIC_SUPABASE_ANON_KEY "sb_publishable_ORO2xFJwBJHRLV74u9neyQ_gzcsgPOK"
push_env SUPABASE_SERVICE_ROLE_KEY "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5a3p3bmdoaWplZGJqaGRpbmxxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTI1NDY0MiwiZXhwIjoyMDkwODMwNjQyfQ.sxG__T5hEhZnzcaqCBnq4qAOrXQUesAjq0iR7py4Ojg"
push_env TELEGRAM_BOT_TOKEN "8687254915:AAExsp2WmwjIw1CMV5lzI-O54AMp_pXOumQ"
push_env SLACK_CLIENT_ID "10848283109060.10848295222548"
push_env SLACK_CLIENT_SECRET "8027adfea18787f04e6c7565a5e9dc51"
push_env SLACK_SIGNING_SECRET "911b488dcc933654a33b69b11273cdf7"
push_env SLACK_BOT_TOKEN "xoxb-10848283109060-10829254539351-W04xBPTzP2GUDvqHsFYas9ms"
push_env RAZORPAY_KEY_ID "rzp_test_SZF37LBHM4Ami5"
push_env RAZORPAY_KEY_SECRET "MXihFSG7MJXMMhIzPptiJ1cW"
push_env GEMINI_API_KEY "AIzaSyAbeEnYXMGMzvG31bnnlihaJJH3_ymgcC4"

echo "Done!"
