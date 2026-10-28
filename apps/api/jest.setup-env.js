// Specs run against a non-production API that opts in to the dev secrets (`_devVerificationLink`,
// `_devCode`), because they have no inbox to read them from.
process.env.EXPOSE_DEV_SECRETS = 'true';
