/* eslint-disable no-undef, no-unused-vars */
import * as React from 'react';
import * as _ from 'lodash-es';

import { OAuthModel } from '../../models';
import { K8sResourceKind, referenceForModel } from '../../module/k8s';
import { DetailsPage } from '../factory';
import {
  EmptyBox,
  Kebab,
  navFactory,
  SectionHeading,
  ResourceSummary,
} from '../utils';
import { formatDuration } from '../utils/datetime';

const { common } = Kebab.factory;
const menuActions = [...common];

const oAuthReference = referenceForModel(OAuthModel);

// Convert to ms for formatDuration
const tokenDuration = (seconds: number) => _.isNil(seconds * 1000) ? '-' : formatDuration(seconds);

const IdentityProviders: React.SFC<IdentityProvidersProps> = ({identityProviders}) => {
  return _.isEmpty(identityProviders)
    ? <EmptyBox label="Identity Providers" />
    : <div className="co-table-container">
      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Challenge</th>
            <th>Login</th>
          </tr>
        </thead>
        <tbody>
          {_.map(identityProviders, idp => (
            <tr key={idp.name}>
              <td>{idp.name}</td>
              <td>{idp.type}</td>
              <td>{idp.challenge ? 'true' : 'false'}</td>
              <td>{idp.login ? 'true' : 'false'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>;
};

const OAuthDetails: React.SFC<OAuthDetailsProps> = ({obj}: {obj: K8sResourceKind}) => {
  const { identityProviders, tokenConfig = {} } = obj.spec;
  const { accessTokenMaxAgeSeconds, authorizeTokenMaxAgeSeconds } = tokenConfig;
  return <React.Fragment>
    <div className="co-m-pane__body">
      <SectionHeading text="OAuth Overview" />
      <ResourceSummary resource={obj} showPodSelector={false} showNodeSelector={false}>
        <dt>Max Age: Access Token</dt>
        <dd>{tokenDuration(accessTokenMaxAgeSeconds)}</dd>
        <dt>Max Age: Authorize Token</dt>
        <dd>{tokenDuration(authorizeTokenMaxAgeSeconds)}</dd>
      </ResourceSummary>
    </div>
    <div className="co-m-pane__body">
      <SectionHeading text="Identity Providers" />
      <p className="co-m-pane__explanation">
        Identity providers determine how users log into the cluster.
      </p>
      <IdentityProviders identityProviders={identityProviders} />
    </div>
  </React.Fragment>;
};

export const OAuthDetailsPage: React.SFC<OAuthDetailsPageProps> = props => (
  <DetailsPage
    {...props}
    kind={oAuthReference}
    menuActions={menuActions}
    pages={[navFactory.details(OAuthDetails), navFactory.editYaml()]}
  />
);

type IdentityProvidersProps = {
  identityProviders: any[];
};

type OAuthDetailsProps = {
  obj: K8sResourceKind;
};

type OAuthDetailsPageProps = {
  match: any;
};
