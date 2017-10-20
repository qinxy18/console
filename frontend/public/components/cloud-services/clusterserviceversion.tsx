/* eslint-disable no-undef, no-unused-vars */

import * as React from 'react';
import { Link } from 'react-router-dom';
import * as _ from 'lodash';

import { ClusterServiceVersionKind, ClusterServiceVersionLogo, K8sResourceKind } from './index';
import { ClusterServiceVersionResourcesPage } from './clusterserviceversion-resource';
import { DetailsPage, ListPage, ListHeader, ColHead } from '../factory';
import { navFactory, FirehoseHoC, StatusBox, Timestamp, ResourceLink, Overflow, Dropdown, history } from '../utils';
import { k8sList, k8sKinds } from '../../module/k8s';

export const ClusterServiceVersionListItem: React.StatelessComponent<ClusterServiceVersionListItemProps> = (props) => {
  const {appType, namespaces = []} = props;
  const route = (name, namespace) => `/ns/${namespace}/clusterserviceversion-v1s/${name}`;

  return <div className="co-clusterserviceversion-list-item">
    <div className="co-clusterserviceversion-list-item__heading">
      <div className="co-clusterserviceversion-list-item__heading__logo">
        <ClusterServiceVersionLogo icon={_.get(appType, 'spec.icon', [])[0]} displayName={appType.spec.displayName} version={appType.spec.version} provider={appType.spec.provider} />
      </div>
    </div>
    <div className="co-clusterserviceversion-list-item__description">{_.get(appType.spec, 'description', 'No description available')}</div>
    <div className="co-clusterserviceversion-list-item__actions">
      { namespaces.length > 1
        ? <Dropdown
          title="View namespace"
          items={namespaces.reduce((acc, ns) => ({...acc, [ns]: ns}), {})}
          onChange={(ns) => history.push(`${route(appType.metadata.name, ns)}/details`)} />
        : <Link to={`${route(appType.metadata.name, appType.metadata.namespace)}/details`} title="View details" className="btn btn-default">View details</Link> }
      { namespaces.length === 1 && <Link to={`${route(appType.metadata.name, appType.metadata.namespace)}/resources`} title="View resources">View resources</Link> }
    </div>
  </div>;
};

export const ClusterServiceVersionHeader: React.StatelessComponent = () => <ListHeader>
  <ColHead className="col-xs-8">Name</ColHead>
  <ColHead className="col-xs-4">Actions</ColHead>
</ListHeader>;

export const ClusterServiceVersionRow: React.StatelessComponent<ClusterServiceVersionRowProps> = ({obj: appType}) => {
  const route = `/ns/${appType.metadata.namespace}/clusterserviceversion-v1s/${appType.metadata.name}`;

  return <div className="row co-resource-list__item">
    <div className="col-xs-8">
      <ResourceLink kind={appType.kind} namespace={appType.metadata.namespace} title={appType.metadata.name} name={appType.metadata.name} />
    </div>
    <div className="col-xs-4">
      <Link to={`${route}/details`} title="View details" className="btn btn-default">View details</Link>
      <Link to={`${route}/resources`} title="View resources">View resources</Link>
    </div>
  </div>;
};

export class ClusterServiceVersionList extends React.Component<ClusterServiceVersionListProps, ClusterServiceVersionListState> {
  constructor(props: ClusterServiceVersionListProps) {
    super(props);
    this.state = {resourceExists: new Map()};
    this.getCustomResources(props.data);
  }

  componentWillReceiveProps(nextProps: ClusterServiceVersionListProps) {
    this.getCustomResources(nextProps.data);
  }

  render() {
    const {loaded, filters} = this.props;
    const {resourceExists, loadError} = this.state;

    const apps = Object.keys(filters).reduce((filteredData, filterName) => {
      // FIXME(alecmerdler): Make these cases into TypeScript `enum` values
      switch (filterName) {
        case 'name':
          return filteredData.filter((appType) => appType.spec.displayName.toLowerCase().includes(filters[filterName].toLowerCase()));
        case 'clusterserviceversion-status':
          if (filters[filterName] === 'running') {
            return filteredData.filter(({spec}) => spec.customresourcedefinitions.owned.map(({name}) => resourceExists.get(name) || false).indexOf(true) > -1);
          } else if (filters[filterName] === 'notRunning') {
            return filteredData.filter(({spec}) => spec.customresourcedefinitions.owned.map(({name}) => resourceExists.get(name) || false).indexOf(true) === -1);
          }
          return filteredData;
        case 'clusterserviceversion-catalog':
          return filteredData.filter((appType) => filters[filterName] === 'all' || appType.spec.labels['alm-catalog'] === filters[filterName]);
        default:
          return filteredData;
      }
    }, this.props.data || []);

    const namespacesForApp = apps.reduce((namespaces, app) => {
      return namespaces.set(app.metadata.name, (namespaces.get(app.metadata.name) || []).concat([app.metadata.namespace]));
    }, new Map<string, string[]>());

    return loaded && apps.length > 0
      ? <div className="co-clusterserviceversion-list">
        <div className="co-clusterserviceversion-list__section co-clusterserviceversion-list__section--catalog">
          <h1 className="co-section-title">Open Cloud Services</h1>
          <div className="co-clusterserviceversion-list__section--catalog__items">
            { apps.reduce((visibleApps: ClusterServiceVersionKind[], app) => {
              return (visibleApps.find(csv => csv.metadata.name === app.metadata.name) === undefined) ? visibleApps.concat([app]) : visibleApps;
            }, []).map((appType, i) => <div className="co-clusterserviceversion-list__section--catalog__items__item" key={i}>
              <ClusterServiceVersionListItem appType={appType} namespaces={namespacesForApp.get(appType.metadata.name)} />
            </div>) }
          </div>
        </div>
      </div>
      : <StatusBox label="Applications" loaded={loaded} loadError={loadError} />;
  }

  private getCustomResources(data: ClusterServiceVersionKind[] = []) {
    const kindToName = new Map<string, string>();

    Promise.all((data || []).map((appType) => k8sList(k8sKinds.CustomResourceDefinition, {labelSelector: appType.spec.selector.matchLabels})))
      .then((items) => items.filter(list => list.length > 0)
        .reduce((allCRDs, list) => allCRDs.concat(list), [])
        .map((crd) => {
          kindToName.set(crd.spec.names.kind, crd.metadata.name);
          return crd;
        })
        .map(crd => k8sList(k8sKinds[crd.spec.names.kind])))
      .then(requests => Promise.all(requests))
      .then(allCustomResources => allCustomResources.reduce((resourceExists: Map<string, boolean>, resources: K8sResourceKind[]) => {
        return resources.length > 0 ? resourceExists.set(kindToName.get(resources[0].kind), true) : resourceExists;
      }, new Map()))
      .then((resourceExists: Map<string, boolean>) => this.setState({resourceExists}))
      .catch(loadError => this.setState({loadError}));
  }
}

export const ClusterServiceVersionsPage: React.StatelessComponent<ClusterServiceVersionsPageProps> = (props) => {
  const dropdownFilters = [{
    type: 'clusterserviceversion-status',
    items: {
      all: 'Status: All',
      running: 'Status: Running',
      notRunning: 'Status: Not Running',
    },
    title: 'Running Status',
  }, {
    type: 'clusterserviceversion-catalog',
    items: {
      all: 'Catalog: All',
    },
    title: 'Catalog',
  }];

  return <ListPage {...props} dropdownFilters={dropdownFilters} ListComponent={ClusterServiceVersionList} filterLabel="Applications by name" title="Installed Applications" showTitle={true} />;
};

export const ClusterServiceVersionDetails: React.StatelessComponent<ClusterServiceVersionDetailsProps> = (props) => {
  const {spec, metadata} = props.obj;

  return <div className="co-clusterserviceversion-details co-m-pane__body">
    <div className="co-clusterserviceversion-details__section co-clusterserviceversion-details__section--info">
      <dl className="co-clusterserviceversion-details__section--info__item">
        <dt>Provider</dt>
        <dd>{spec.provider && spec.provider.name ? spec.provider.name : 'Not available'}</dd>
        <dt>Created At</dt>
        <dd><Timestamp timestamp={metadata.creationTimestamp} /></dd>
      </dl>
      <dl className="co-clusterserviceversion-details__section--info__item">
        <dt>Links</dt>
        { spec.links && spec.links.length > 0
          ? spec.links.map((link, i) => <dd key={i} style={{display: 'flex', flexDirection: 'column'}}>
            {link.name} <a href={link.url}>{link.url}</a>
          </dd>)
          : <dd>Not available</dd> }
      </dl>
      <dl className="co-clusterserviceversion-details__section--info__item">
        <dt>Maintainers</dt>
        { spec.maintainers && spec.maintainers.length > 0
          ? spec.maintainers.map((maintainer, i) => <dd key={i} style={{display: 'flex', flexDirection: 'column'}}>
            {maintainer.name} <a href={`mailto:${maintainer.email}`}><Overflow value={maintainer.email} /></a>
          </dd>)
          : <dd>Not available</dd> }
      </dl>
    </div>
    <div className="co-clusterserviceversion-details__section co-clusterserviceversion-details__section--description">
      <h1>Description</h1>
      <span style={{color: spec.description ? '' : '#999'}}>
        {spec.description || 'Not available'}
      </span>
    </div>
  </div>;
};

const Resources = ({obj}) => <FirehoseHoC Component={props => <ClusterServiceVersionResourcesPage {...props} namespace={obj.metadata.namespace} />} kind="CustomResourceDefinition" selector={obj.spec.selector} isList={true} />;

const pages = [
  navFactory.details(ClusterServiceVersionDetails),
  navFactory.editYaml(),
  {href: 'resources', name: 'Resources', component: Resources},
];

export const ClusterServiceVersionsDetailsPage: React.StatelessComponent<ClusterServiceVersionsDetailsPageProps> = (props) => <DetailsPage {...props} pages={pages} />;

export type ClusterServiceVersionsPageProps = {
  kind: string;
};

export type ClusterServiceVersionListProps = {
  loaded: boolean;
  data: ClusterServiceVersionKind[];
  filters: {[key: string]: any};
};

export type ClusterServiceVersionListState = {
  resourceExists: Map<string, boolean>;
  loadError?: any;
};

export type ClusterServiceVersionListItemProps = {
  appType: ClusterServiceVersionKind;
  namespaces: string[];
};

export type ClusterServiceVersionsDetailsPageProps = {
  kind: string;
  name: string;
  namespace: string;
};

export type ClusterServiceVersionDetailsProps = {
  obj: ClusterServiceVersionKind;
};

export type ClusterServiceVersionRowProps = {
  obj: ClusterServiceVersionKind;
};

// TODO(alecmerdler): Find Webpack loader/plugin to add `displayName` to React components automagically
ClusterServiceVersionListItem.displayName = 'ClusterServiceVersionListItem';
ClusterServiceVersionsPage.displayName = 'ClusterServiceVersionsPage';
ClusterServiceVersionsDetailsPage.displayName = 'ClusterServiceVersionsDetailsPage';
ClusterServiceVersionRow.displayName = 'ClusterServiceVersionRow';
ClusterServiceVersionHeader.displayName = 'ClusterServiceVersionHeader';