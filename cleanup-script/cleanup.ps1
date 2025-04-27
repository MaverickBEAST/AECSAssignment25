# -------------------------------------------------------------------------------------------------
#  CLEANUP SCRIPT – POWERSELL (Windows)
# -------------------------------------------------------------------------------------------------

# 1) Edit these values before running:
$CLUSTER    = "better-health-eks2"            # your EKS cluster name
$REGION     = "eu-north-1"
$POOL_ID    = "eu-north-1_Rxxy1sqje"         # your Cognito User Pool ID
$CLIENT_ID  = "3h7k0et1t79tf6ah34bh35givr"                  # your Cognito App Client ID

# (optional) if you have multiple Amplify apps serving your domain, list them here:
$AMPLIFY_DOMAIN = "betterhealthservices.42web.io"

# 2) Static arrays of the resources we created:
$TABLES     = @("Users","Messages","Sessions")
$REPOS      = @("user-service","messaging-service","counsellor-service")

# -------------------------------------------------------------------------------------------------
#  A) Delete Amplify apps for your domain
# -------------------------------------------------------------------------------------------------
Write-Host "`n>>> Deleting any Amplify apps matched by domain $AMPLIFY_DOMAIN ..."
$apps = aws amplify list-apps --region $REGION `
  --query "apps[?contains(domain,'$AMPLIFY_DOMAIN')].appId" `
  --output text
if ($apps) {
  $apps.Split() | ForEach-Object {
    Write-Host "   • delete-app $_"
    aws amplify delete-app --app-id $_ --region $REGION
  }
} else {
  Write-Host "   (no Amplify apps found for that domain)"
}

# -------------------------------------------------------------------------------------------------
#  B) Tear down DynamoDB tables
# -------------------------------------------------------------------------------------------------
Write-Host "`n>>> Deleting DynamoDB tables..."
foreach ($tbl in $TABLES) {
  Write-Host "   • Deleting table $tbl"
  aws dynamodb delete-table --table-name $tbl --region $REGION
  Write-Host "     Waiting until $tbl is fully deleted..."
  aws dynamodb wait table-not-exists --table-name $tbl --region $REGION
}

# -------------------------------------------------------------------------------------------------
#  C) Tear down Cognito User Pool + Client
# -------------------------------------------------------------------------------------------------
Write-Host "`n>>> Deleting Cognito App Client $CLIENT_ID"
aws cognito-idp delete-user-pool-client `
  --user-pool-id $POOL_ID `
  --client-id $CLIENT_ID `
  --region $REGION

Write-Host ">>> Deleting Cognito User Pool $POOL_ID"
aws cognito-idp delete-user-pool `
  --user-pool-id $POOL_ID `
  --region $REGION

# -------------------------------------------------------------------------------------------------
#  D) Delete ECR repositories and all images
# -------------------------------------------------------------------------------------------------
Write-Host "`n>>> Deleting ECR repositories..."
foreach ($repo in $REPOS) {
  Write-Host "   • $repo"
  aws ecr delete-repository `
    --repository-name $repo `
    --force `
    --region $REGION
}

# -------------------------------------------------------------------------------------------------
#  E) Tear down Kubernetes objects (Ingress, Secrets, Deployments) & NGINX
# -------------------------------------------------------------------------------------------------
Write-Host "`n>>> Removing k8s ingress, secrets, deployments & NGINX controller..."
# make sure your kubeconfig is pointing at the correct cluster
kubectl delete ingress backend-ingress --ignore-not-found
kubectl delete secret tls-selfsigned --ignore-not-found
kubectl delete -f backend.yaml --ignore-not-found
helm uninstall ingress-nginx -n ingress-nginx --ignore-not-found
kubectl delete namespace ingress-nginx --ignore-not-found

# -------------------------------------------------------------------------------------------------
#  F) Delete the EKS cluster (and all nodegroups / AWS load-balancer‐LBS)
# -------------------------------------------------------------------------------------------------
Write-Host "`n>>> Deleting EKS Cluster $CLUSTER (this may take 10+ minutes)..."
eksctl delete cluster --name $CLUSTER --region $REGION

Write-Host "`nCleanup kicked off.  Verify in the AWS console or by re-running the list commands above.`n"
