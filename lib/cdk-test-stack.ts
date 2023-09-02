import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { CfnConnection } from 'aws-cdk-lib/aws-codestarconnections';
import { CodePipeline, CodePipelineSource, ShellStep } from 'aws-cdk-lib/pipelines';

class OtherStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
	super(scope, id, props);
	const bucket = new s3.Bucket(this, "bucket", {
	    blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
	    encryption: s3.BucketEncryption.S3_MANAGED,
	    enforceSSL: true,
	    versioned: true,
	    removalPolicy: cdk.RemovalPolicy.DESTROY,
	});
    }
}

class OtherStage extends cdk.Stage {
    constructor(scope: Construct, id: string, props: cdk.StageProps) {
	super(scope, id, props);

	var targetEnv = (props ? props.env : {
	    account: this.account,
	    region: this.region
	});
	const stack = new OtherStack(this, "other-stack", {
	    env: targetEnv
	});
    }
}

class CrossAcctStack extends cdk.Stack {
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

class CrossAcctStage extends cdk.Stage {
    constructor(scope: Construct, id: string, props: cdk.StageProps) {
	super(scope, id, props);

	var targetEnv = (props ? props.env : {
	    account: this.account,
	    region: this.region
	});
	const stack = new CrossAcctStack(this, "cross-account-stack", {
	    env: targetEnv
	});
    }
}

export class CdkTestStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
	super(scope, id, props);

	const repoName = "cdk-test";
	const repoOwner = "Gothmagog";
	const ctx_acct_ids = this.node.tryGetContext("accounts");
	const ctx_regions = this.node.tryGetContext("regions");
	const acct_ids = ctx_acct_ids.split(",");
	const regions = ctx_regions.split(",");
	
	// Setup Pipeline
	const csConnection = new CfnConnection(this, "codestar-connection", {
	    connectionName: "github-connection-5yhg8d",
	    providerType: "GitHub"
	});
	const pipeline = new CodePipeline(this, `${id}-pipeline`, {
	    pipelineName: 'CdkTestPipeline',
            crossAccountKeys: true,
	    dockerEnabledForSynth: true,
            selfMutation: true,
	    useChangeSets: false,
	    synth: new ShellStep('Synth', {
		input: CodePipelineSource.connection(`${repoOwner}/${repoName}`, 'main', {
		    connectionArn: csConnection.attrConnectionArn
		}),
		commands: [
		    'npm install',
		    `npx cdk synth -c accounts=${ctx_acct_ids} -c regions=${ctx_regions} -v`
		]
	    })
	});
	const otherStage = new OtherStage(this, "other-stage", {
	    env: {
		account: this.account,
		region: this.region
	    }
	});
	pipeline.addStage(otherStage);
	const wave = pipeline.addWave("Cross-Account-Deployments");
	for (var a = 0; a < acct_ids.length; a++) {
	    for (var r = 0; r < regions.length; r++) {
		wave.addStage(new CrossAcctStage(this, `stack-${acct_ids[a]}-${regions[r]}`, {
		    env: {
			account: acct_ids[a],
			region: regions[r],
		    }
		}));
	    }
	}
	
    }
}
