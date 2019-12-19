import ProxyPool from "./ProxyPool";
import Proxy, {ProxyConfig} from "./Proxy";
import {Filter, filterCb} from "./source/filter";
import {Sorter, sorterCb} from "./source/sorter";
import {Prune, pruneCb} from "./source/prune";
import {groupCb} from "./source/group";

export interface SourceComponent {
    filters?: Filter[],
    sorter?: Sorter,
    prune?: Prune,
    group?: string,
    paginate?: boolean
}

export interface SourceConfig extends SourceComponent, ProxyConfig {
    handleDataChange?: Function
}

export interface HandleFunc {
    (data: object[], params?: any): object[];
}

export interface Pagination {
    total: number,
    currentPage: number,
    lastPage: number,
    perPage: number,
    from: number,
    to: number,
    previous: Function,
    hasPreviousPage: Function,
    next: Function,
    hasNextPage: Function,
}

export default class Source {
    protected readonly proxy: Proxy;
    protected _data: object[] = [];
    private _filters?: Filter[];
    private _sorter?: Sorter;
    private _prune?: Prune;
    private _group?: string;
    private _paginate?: boolean;
    //handles Callback's
    protected _handleDataChange?: Function;
    protected _handleError?: Function;
    protected _handleLoading?: Function;
    protected _handleMapping?: HandleFunc;
    protected _handleFilters: HandleFunc = filterCb;
    protected _handleSorter: HandleFunc = sorterCb;
    protected _handlePrune: HandleFunc = pruneCb;
    protected _handleGroup: HandleFunc = groupCb;

    constructor(args: SourceConfig) {
        this._filters    = args.filters;
        this._sorter     = args.sorter;
        this._prune      = args.prune;
        this._group      = args.group;
        this._paginate   = !!args.paginate;
        if (args.paginate && !this._prune) {
            // pagination default
            this._prune  = { start: 0, limit: 20 };
        }
        this.proxy       = ProxyPool.add(args);
        this._handleDataChange = args.handleDataChange;
        this.proxy.on(Proxy.LOAD_DATA_EVENT, (data: object[]) => this.data = data);
        this.proxy.on(Proxy.LOADING_EVENT, (loading: boolean) => this.loading = loading);
        this.proxy.on(Proxy.ERROR_EVENT, (reason: any) => this.error = reason);
    }

    set handleDataChange(cb: Function) {
        this._handleDataChange = cb;
    }

    set handleError(cb: Function) {
        this._handleError = cb;
    }

    set handleLoading(cb: Function) {
        this._handleLoading = cb;
    }

    set handleMapping(cb: HandleFunc) {
        this._handleMapping = cb;
        this.updateData(this.proxy.data);
    }

    set handleFilters(cb: HandleFunc) {
        this._handleFilters = cb;
        this.updateData(this.proxy.data);
    }

    set handleSorter(cb: HandleFunc) {
        this._handleSorter = cb;
        this.updateData(this.proxy.data);
    }

    set handlePrune(cb: HandleFunc) {
        this._handlePrune = cb;
    }

    set handleGroup(cb: HandleFunc) {
        this._handleGroup = cb;
    }

    protected changeData(): void {
        this._handleDataChange &&
        this._handleDataChange(this.wrapper);
    }

    protected applyMapping(data: object[]): object[] { // for adding data
        return this._handleMapping ? this._handleMapping(data) : data;
    }

    protected applyFilters(data: object[]): object[] {
        return this._filters && this._handleFilters ? this._handleFilters(data, this._filters) : data;
    }

    protected applySorter(data: object[]): object[] {
        return this._sorter && this._handleSorter ? this._handleSorter(data, this._sorter) : data;
    }

    protected applyPrune(data: object[]): object[] {
        return this._prune && this._handlePrune ? this._handlePrune(data, this._prune) : data;
    }

    protected applyGroup(data: object[]): object[] { //unused
        return this._group && this._handleGroup ? this._handleGroup(data, this._group) : data;
    }

    protected updateData(data: object[]): void {
        let dataMapping = this.applyMapping(data);
        let dataFiltered = this.applyFilters(dataMapping);
        let dataSortered = this.applySorter(dataFiltered);
        this._data = dataSortered;
    }

    set data(data: object[]) {
        this.updateData(data);
        this.changeData();
    }

    get data(): object[] {
        return this.wrapper.data;
    }

    get wrapper(): { data: object[] } {
        let wrapper = { data: this.applyPrune(this._data) };
        if (this._paginate === true && this._prune) {
            Object.assign(wrapper, this.pagination());
        }
        return wrapper;
    }

    private pagination(): Pagination {
        const length = this._data.length;
        const limit = this._prune && this._prune.limit || 20;
        const start = this._prune && this._prune.start || 0;

        return {
            total: length,
            currentPage: Math.floor(start / limit ) + 1,
            lastPage: Math.floor( length / limit ),
            perPage: limit,
            from: start,
            to: limit + start,
            previous: () => { Object.assign(this._prune, { start: Math.max(start - limit, 0)}); this.changeData() },
            hasPreviousPage: () => { return start > 0 },
            next: () => { Object.assign(this._prune, { start: Math.min(start + limit, Math.floor(length / limit) * limit ) }); this.changeData() },
            hasNextPage: () => { return (limit + start) < length },
        }
    }

    set loading(value: boolean) {
        this._handleLoading &&
        this._handleLoading(value);
    }

    set error(value: any) {
        this._handleError &&
        this._handleError(value);
    }

    set filters(value: Filter[]) {
        this._filters = value;
        Object.assign(this._prune, { start: 0 });
        this.data = this.proxy.data;
    }

    set sorter(value: Sorter) {
        this._sorter = value;
        this.data = this.proxy.data;
    }

    set prune(value: Prune) {
        this._prune = value;
    }

    set group(value: string) {
        this._group = value;
    }
}
