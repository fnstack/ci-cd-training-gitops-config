import { App, Chart, ChartProps, Size } from 'cdk8s';
import { Construct } from 'constructs';
import * as kplus from 'cdk8s-plus-27';
import * as k8s from './imports/k8s';

export class WorkshopChart extends Chart {
  constructor(scope: Construct, id: string, props: ChartProps = {}) {
    super(scope, id, props);

    // Namespace
    const namespace = new kplus.Namespace(this, 'workshop-namespace', {
      metadata: { name: 'training-cicd' }
    });

    // Secret pour le registry Gitea (aligné avec le Jour 2)
    const giteaSecret = new k8s.KubeSecret(this, 'gitea-registry-secret', {
      metadata: {
        name: 'gitea-registry-secret',
        namespace: 'training-cicd'
      },
      type: 'kubernetes.io/dockerconfigjson',
      data: {
        '.dockerconfigjson': this.createDockerConfigJson()
      }
    });

    // Convert KubeSecret to ISecret for dockerRegistryAuth
    const registryAuth = kplus.Secret.fromSecretName(this, 'registry-auth-ref', 'gitea-registry-secret');

    // .NET API (from Day 2) avec imagePullSecrets
    const dotnetApi = new kplus.Deployment(this, 'dotnet-api', {
      metadata: { name: 'dotnet-api', namespace: 'training-cicd' },
      replicas: 2,
      select: false,
      dockerRegistryAuth: registryAuth,
      podMetadata: {
        labels: { app: 'dotnet-api' }
      }
    });

    const dotnetContainer = dotnetApi.addContainer({
      name: 'dotnet-api',
      image: 'gitea.arpce.fnstack.dev/fnstack/dotnet-api',
      port: 8080,
      envVariables: {
        'ASPNETCORE_ENVIRONMENT': kplus.EnvValue.fromValue('Production')
      },
      resources: {
        cpu: {
          request: kplus.Cpu.millis(200),
          limit: kplus.Cpu.millis(1000)
        },
        memory: {
          request: Size.mebibytes(256),
          limit: Size.gibibytes(1)
        }
      }
    });


    // Exposer l'API via Service
    dotnetApi.exposeViaService({
      name: 'dotnet-api-service',
      ports: [{ port: 8080, nodePort: 30001 }],
      serviceType: kplus.ServiceType.NODE_PORT
    });

    // Web App (from Day 2) avec imagePullSecrets
    const webApp = new kplus.Deployment(this, 'web-app', {
      metadata: { name: 'web-app', namespace: 'training-cicd' },
      replicas: 2,
      select: false,
      dockerRegistryAuth: registryAuth,
      podMetadata: {
        labels: { app: 'web-app' }
      }
    });

    const webAppContainer = webApp.addContainer({
      name: 'web-app',
      image: 'gitea.arpce.fnstack.dev/fnstack/web-app',
      port: 3000,
      envVariables: {
        'NEXT_PUBLIC_API_URL': kplus.EnvValue.fromValue('http://dotnet-api-service:8080')
      },
      resources: {
        cpu: {
          request: kplus.Cpu.millis(100),
          limit: kplus.Cpu.millis(500)
        },
        memory: {
          request: Size.mebibytes(128),
          limit: Size.mebibytes(512)
        }
      }
    });


    // Exposer la Web App via Service
    webApp.exposeViaService({
      name: 'web-app-service',
      ports: [{ port: 3000, nodePort: 30002 }],
      serviceType: kplus.ServiceType.NODE_PORT
    });
  }

  private createDockerConfigJson(): string {
    const dockerConfig = {
      auths: {
        'gitea.arpce.fnstack.dev': {
          username: process.env.GITEA_USERNAME || 'your-username',
          password: process.env.GITEA_TOKEN || 'your-token',
          email: process.env.GITEA_EMAIL || 'your-email@domain.local',
          auth: Buffer.from(`${process.env.GITEA_USERNAME || 'your-username'}:${process.env.GITEA_TOKEN || 'your-token'}`).toString('base64')
        }
      }
    };
    return Buffer.from(JSON.stringify(dockerConfig)).toString('base64');
  }
}

// Instantiation de l'application
const app = new App();
new WorkshopChart(app, 'training-cicd');
app.synth();