#----------------------------
# CONFIG
#----------------------------
$REGION = "eu-north-1"
$STACK  = "better-health-full-infra"

#----------------------------
# 1) Delete the CloudFormation stack
#----------------------------
Write-Host "Deleting CloudFormation stack…” -ForegroundColor Cyan
aws cloudformation delete-stack `
  --stack-name $STACK `
  --region $REGION

Write-Host "Waiting for stack to fully delete…” -ForegroundColor Cyan
aws cloudformation wait stack-delete-complete `
  --stack-name $STACK `
  --region $REGION

#----------------------------
# 2) Delete ECR repos
#----------------------------
$repos = @("user-service","messaging-service","counsellor-service")
foreach ($r in $repos) {
  Write-Host "Deleting ECR repo $r…” -ForegroundColor Cyan
  aws ecr delete-repository `
    --repository-name $r `
    --force `
    --region $REGION
}

#----------------------------
# 3) Delete DynamoDB tables
#----------------------------
$tables = @("Users","Messages","Sessions")
foreach ($t in $tables) {
  Write-Host "Deleting DynamoDB table $t…” -ForegroundColor Cyan
  aws dynamodb delete-table `
    --table-name $t `
    --region $REGION
}

#----------------------------
# 4) Delete Cognito User Pool
#----------------------------
Write-Host "Finding & deleting Cognito User Pool…” -ForegroundColor Cyan
$poolId = aws cognito-idp list-user-pools `
  --max-results 60 `
  --region $REGION `
  --query "UserPools[?Name=='betterhealth-userpool'].Id" `
  --output text

if ($poolId) {
  aws cognito-idp delete-user-pool `
    --user-pool-id $poolId `
    --region $REGION
} else {
  Write-Host "No user pool found, skipping." -ForegroundColor Yellow
}

#----------------------------
# 5) Delete Amplify App (and branch)
#----------------------------
Write-Host "Finding & deleting Amplify App…” -ForegroundColor Cyan
$appId = aws amplify list-apps `
  --region $REGION `
  --query "apps[?name=='betterhealth-frontend'].appId" `
  --output text

if ($appId) {
  aws amplify delete-app `
    --app-id $appId `
    --region $REGION
} else {
  Write-Host "No Amplify app found, skipping." -ForegroundColor Yellow
}

#----------------------------
# 6) Remove leftover Amplify S3 buckets
#----------------------------
Write-Host "Cleaning up Amplify hosting buckets…” -ForegroundColor Cyan
$buckets = aws s3api list-buckets `
  --query "Buckets[?contains(Name,'amplify-betterhealth-frontend')].Name" `
  --output text

foreach ($b in $buckets) {
  Write-Host "Emptying & deleting bucket $b…” -ForegroundColor Cyan
  aws s3 rm "s3://$b" --recursive
  aws s3api delete-bucket --bucket $b --region $REGION
}

#----------------------------
# DONE
#----------------------------
Write-Host "✅ All done! Everything should be cleaned up." -ForegroundColor Green
