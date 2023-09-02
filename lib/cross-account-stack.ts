import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class CrossAcctStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
	super(scope, id, props);

	const codeDir = `${__dirname}/asset-dir`;
	const provider = cdk.CustomResourceProvider.getOrCreateProvider(this, 'Custom::DataSourceCreator', {
	    codeDirectory: codeDir,
	    runtime: cdk.CustomResourceProviderRuntime.NODEJS_18_X,
	    environment: {
		AWS_ACCOUNT_ID: this.account
	    },
	    timeout: cdk.Duration.minutes(3)
	});
	new cdk.CustomResource(this, 'custom-resource', {
	    resourceType: 'Custom::DataSourceCreator',
	    serviceToken: provider.serviceToken
	});	
    }
}
