import { App, Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import * as k8s from './imports/k8s';

export class SecretsChart extends Chart {
  constructor(scope: Construct, id: string, props: ChartProps = {}) {
    super(scope, id, props);
    // Secret pour l'authentification au registry Gitea
    // Configuration identique au Jour 2
    new k8s.KubeSecret(this, 'gitea-registry-secret', {
      metadata: {
        name: 'gitea-registry-secret',
        namespace: 'training-cicd'
      },
      type: 'kubernetes.io/dockerconfigjson',
      data: {
        '.dockerconfigjson': this.createDockerConfigJson(
          'gitea.arpce.fnstack.dev',
          process.env.GITEA_USERNAME || 'rajivhost',
          process.env.GITEA_TOKEN || 'P@$$w0rd',
          process.env.GITEA_EMAIL || 'rajiv.mounguengue@gmail.com'
        )
      }
    });
  }
  private createDockerConfigJson(server: string, username: string, password: string, email: string): string {
    const dockerConfig = {
      auths: {
        [server]: {
          username: username,
          password: password,
          email: email,
          auth: Buffer.from(`${username}:${password}`).toString('base64')
        }
      }
    };
    return Buffer.from(JSON.stringify(dockerConfig)).toString('base64');
  }
}