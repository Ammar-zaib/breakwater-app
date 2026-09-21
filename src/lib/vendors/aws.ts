/**
 * Sourced from AWS's own developer blog post announcing end-of-support for
 * the JavaScript v2 SDK (aws.amazon.com/blogs/developer/announcing-end-of-
 * support-for-aws-sdk-for-javascript-v2) as of this writing. Keep this file
 * the single source of truth for what the scan prompt is allowed to claim
 * about AWS — never let the model invent facts about a vendor beyond what's
 * written here.
 */
export const AWS_BRIEFING = `
Reference briefing on AWS SDK for JavaScript versioning (treat as ground truth; do not contradict it):
- The AWS SDK for JavaScript has two incompatible major lines: v2 (the "aws-sdk" package, callback/promise-based, monolithic client objects like "new AWS.S3()") and v3 (scoped packages like "@aws-sdk/client-s3", modular, command-based with "new S3Client()" + "send(new GetObjectCommand(...))").
- AWS SDK for JavaScript v2 reached END-OF-SUPPORT on September 8, 2025. Its timeline was: general availability with new features until September 7, 2024; then one year of maintenance mode (critical bug fixes and security patches only) until September 7, 2025; then end-of-support — no further updates, security patches, or bug fixes of any kind, ever.
- Code still using the v2 "aws-sdk" package (imports like require("aws-sdk") or import AWS from "aws-sdk", and constructors like "new AWS.S3(", "new AWS.DynamoDB(") is running on a permanently frozen, unpatched SDK. It will keep working today, but any future AWS-side API change, new security vulnerability, or Node.js runtime deprecation that the v2 SDK doesn't already handle will never be fixed.
- AWS's own recommended fix is migrating to v3 (the "@aws-sdk/client-*" packages), which they describe as the actively maintained, modular replacement. AWS provides an automated migration tool for this, since v3's API shape (command objects, explicit client instantiation per service) differs meaningfully from v2's monolithic client methods.
- This is a "frozen SDK" risk, distinct from Stripe/Twilio-style "silent version drift" risk: nothing breaks automatically, but the exposure is permanent and grows — every day on v2 is another day without security patches on a component that talks to production AWS credentials.
`.trim();

export const AWS_SEARCH_TERMS = ["aws-sdk", "@aws-sdk/client-", "new AWS."];
