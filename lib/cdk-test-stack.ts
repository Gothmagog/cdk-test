import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CfnConnection } from 'aws-cdk-lib/aws-codestarconnections';
import { CodePipeline, CodePipelineSource, ShellStep } from 'aws-cdk-lib/pipelines';

class CrossAcctStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
	super(scope, id, props);

	const provider = cdk.CustomResourceProvider.getOrCreateProvider(this, 'Custom::DataSourceCreator', {
	    codeDirectory: `${__dirname}/asset-dir`,
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
