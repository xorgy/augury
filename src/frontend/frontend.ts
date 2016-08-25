import {
  Component,
  NgModule,
  NgZone,
  enableProdMode,
} from '@angular/core';
import * as Rx from 'rxjs';
import SplitPane from './components/split-pane/split-pane';
import TabMenu from './components/tab-menu/tab-menu';
import { BackendActions } from './actions/backend-actions/backend-actions';
import { BackendMessagingService } from './channel/backend-messaging-service';
import { BrowserModule } from '@angular/platform-browser';
import { ComponentDataStore } from './stores/component-data/component-data-store';
import { Dispatcher } from './dispatcher/dispatcher';
import { FormsModule } from '@angular/forms';
import { Header } from './components/header/header';
import { InfoPanel } from './components/info-panel/info-panel';
import { ParseUtils } from './utils/parse-utils';
import { RouterTree } from './components/router-tree/router-tree';
import { TreeView } from './components/tree-view/tree-view';
import { UserActionType } from './actions/action-constants';
import { UserActions } from './actions/user-actions/user-actions';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

const BASE_STYLES = require('!style!css!postcss!../styles/app.css');

// (ericjim) tweak this value to control the depth in which
// the component tree will render initially.
const ALLOWED_DEPTH: number = 3;

@Component({
  selector: 'bt-app',
  providers: [ParseUtils],
  directives: [
    Header,
    InfoPanel,
    RouterTree,
    SplitPane,
    TabMenu,
    TreeView
  ],
  template: `
    <div class="clearfix vh-100 overflow-hidden flex flex-column"
      [ngClass]="theme">
      <augury-header
        [tabs]="tabs"
        [selectedTabIndex]="selectedTabIndex"
        [theme]="theme"
        (themeChange)="themeChange($event)"
        (tabChange)="tabChange($event)">
      </augury-header>
      <split-pane
         class="flex-auto"
         [ngClass]="{ 'flex': selectedTabIndex === 0 }"
         [hidden]="selectedTabIndex !== 0">
        <split-pane-primary-content class="flex flex-column flex-auto">
          <bt-tree-view
             class="flex"
             [changedNodes]="changedNodes"
             [selectedNode]="selectedNode"
             [closedNodes]="closedNodes"
             [tree]="tree"
             [allowedComponentTreeDepth]="allowedComponentTreeDepth">
          </bt-tree-view>
        </split-pane-primary-content>
        <split-pane-secondary-content class="flex flex-column flex-auto">
          <bt-info-panel
             class="flex flex-column flex-auto bg-white"
             [tree]="tree"
             [theme]="theme"
             [node]="selectedNode">
          </bt-info-panel>
        </split-pane-secondary-content>
      </split-pane>
      <bt-router-tree
         class="overflow-scroll flex-auto"
         [theme]="theme"
         [hidden]="selectedTabIndex !== 1"
         [routerTree]="routerTree">
      </bt-router-tree>
    </div>`
})
/**
 * Augury App, the root component of our application.
 */
export class App {

  private tree: any;
  private previousTree: any;
  private routerTree: any;
  private selectedTabIndex = 0;
  private selectedNode: any;
  private closedNodes: Array<any> = [];
  private changedNodes: any = [];
  private theme: string;
  private allowedComponentTreeDepth: number = ALLOWED_DEPTH;

  private tabs = [
    'Component Tree',
    'Router Tree',
  ];

  constructor(
    private backendAction: BackendActions,
    private userActions: UserActions,
    private componentDataStore: ComponentDataStore,
    private _ngZone: NgZone,
    private parseUtils: ParseUtils
  ) {
    chrome.storage.sync.get('theme', (result: any) => {
      // Run in Angular zone so that theme change is detected.
      this._ngZone.run(() => {
        this.theme = result.theme === 'dark' ? 'dark' : 'light';
      });
    });

    this.userActions.startComponentTreeInspection();

    // Listen for changes in selected node
    this.componentDataStore.dataStream
      .filter((data: any) => data.action &&
              data.action === UserActionType.START_COMPONENT_TREE_INSPECTION)
      .subscribe(data => {
        if (!this.tree) {
          this.tree = data.componentData;
        } else {
          this.previousTree = this.tree;
          this.tree = data.componentData;
          this.changedNodes =
            parseUtils.getChangedNodes(this.previousTree, this.tree);
        }
        if (data.selectedNode) {
          const treeMap = this.parseUtils.getNodesMap(this.tree);
          const treeMapNode = treeMap[data.selectedNode.id];
          this.selectedNode = treeMapNode ? JSON.parse(treeMapNode) : undefined;
        }
        this.closedNodes = data.closedNodes;
        this._ngZone.run(() => undefined);
      }
    );

    this.componentDataStore.dataStream
      .filter((data: any) => data.action &&
              data.action === UserActionType.RENDER_ROUTER_TREE)
      .subscribe(data => {
        this.routerTree = data.tree.tree;
        this._ngZone.run(() => undefined);
      }
    );

    this.componentDataStore.dataStream
      .debounce(() => Rx.Observable.timer(250))
      .filter((data: any) => {
        return (data.action &&
          data.action !== UserActionType.GET_DEPENDENCIES &&
          data.action !== UserActionType.RENDER_ROUTER_TREE &&
          data.action !== UserActionType.START_COMPONENT_TREE_INSPECTION &&
          data.action !== UserActionType.CLEAR_TREE);
      })
      .subscribe(({ selectedNode }) => {
        this.selectedNode = selectedNode;
        this._ngZone.run(() => undefined);
      });

    this.componentDataStore.dataStream
      .filter((data: any) => {
        return (data.action &&
          data.action === UserActionType.CLEAR_TREE);
      })
      .subscribe(() => {
        this.tree = [];
        this.previousTree = [];
        this.selectedNode = undefined;
        this._ngZone.run(() => undefined);
      });
  }

  tabChange(index: number) {
    this.selectedTabIndex = index;
    if (index === 1) {
      this.userActions.renderRouterTree();
    }
  }

  themeChange(theme: string): void {
    this.theme = theme;
    // Set the new theme
    chrome.storage.sync.set({ theme });
  }
}

// --- FrontendModule, the module containing our root component.
@NgModule({
  declarations: [App],
  imports: [BrowserModule, FormsModule],
  providers: [
    BackendActions,
    UserActions,
    Dispatcher,
    ComponentDataStore,
    BackendMessagingService
  ],
  bootstrap: [App]
})
class FrontendModule {}

if (process.env.NODE_ENV !== 'development') {
  enableProdMode();
}

// --- Bootstrap the module containing our root component on the web browser.
platformBrowserDynamic().bootstrapModule(FrontendModule);
