
import React from "react";
import HStackRenderer from "./HStackRenderer";
import { is } from "../../is";
import { AlignmentType, cBottom, cBottomLeading, cBottomTrailing, cCenter, cLeading, cTop, cTopLeading, cTopTrailing, cTrailing } from "../UIView/Constants";
import { UIView } from "../UIView/UIView";
import { ViewProperty } from "../UIView/ViewProperty";

type TooltipPositions = any;

export class HStackClass extends UIView {

     /** @internal */
     @ViewProperty() vp_TooltipPosition: TooltipPositions;
     public tooltipPosition(value: TooltipPositions) {
        this.vp_TooltipPosition = value;
        return this;
     }

     

    /** @internal */
    @ViewProperty() vp_Spacing: string;

    /** @internal */
    @ViewProperty() vp_Alignment: string;

    /** @internal */
    @ViewProperty() vp_Chidren: UIView[] | Function;

     /** @internal */
     @ViewProperty() vp_OnClickAway: Function;
     public onClickAway(value: Function) {
        this.vp_OnClickAway = value;
        return this;
     }

    public children(...value: UIView[]) {
        this.vp_Chidren = value;
        return this;
    }

    public constructor() {
        super();
        this.Appearance.FlexDirection = 'row';

        this.Appearance.Display = 'flex';
        this.Appearance.Width = '100%';
        this.Appearance.Height = '100%';
        this.Appearance.AlignContent = 'center';
        this.Appearance.JustifyContent = 'center';

        this.Appearance.AlignItems = 'center';
        this.Appearance.JustifyItems = 'center';

       // this.vp_TooltipPosition = TooltipPositions.BOTTOM;
    }


    /** @internal */
    spacing(value: number): this;
    /** @internal */
    spacing(value: string): this;
    /** @internal */
    spacing(...args: any[]): this {
        if (args.length === 1 && is.string(args[0])) {
            const value: string = args[0];
            this.vp_Spacing = value;
            /*  let lastView = null;
             if (this.SubViews.Count > 0)
                 lastView = this.SubViews[this.SubViews.Count - 1];
             foreach(this.SubViews, (view) => {
                 if (view.Appearance != null && view !== lastView) {
                     view.Appearance.MarginBottom = value;
                 }
             }); */
            return this;
        } else if (args.length === 1 && is.number(args[0])) {
            const value: number = args[0];
            this.vp_Spacing = `${value}px`;
            /*  let lastView = null;
             if (this.SubViews.Count > 0)
                 lastView = this.SubViews[this.SubViews.Count - 1];
             foreach(this.SubViews, (view) => {
                 if (view.Appearance != null && view !== lastView) {
                     view.Appearance.MarginBottom = `${value}px`;
                 }
             }); */
            return this;
        }
        return this;
        /*  throw 'ArgumentOutOfRange Exception in VStack::spacing' */
    }

    /** @internal */
    alignment(value: AlignmentType) {
        if (value == null) {
            return this;
        }

        if (value === cTopLeading) {
            this.Appearance.JustifyContent = 'start';
            this.Appearance.AlignContent = 'start';

            this.Appearance.JustifyItems = 'start';
            this.Appearance.AlignItems = 'start';



        } else if (value === cTop) {
            this.Appearance.JustifyContent = 'center';
            this.Appearance.AlignContent = 'start';

            this.Appearance.JustifyItems = 'center';
            this.Appearance.AlignItems = 'start';


        } else if (value === cTopTrailing) {
            this.Appearance.JustifyContent = 'end';
            this.Appearance.AlignContent = 'start';

            this.Appearance.JustifyItems = 'end';
            this.Appearance.AlignItems = 'start';



        } else if (value === cLeading) {
            this.Appearance.JustifyContent = 'start';
            this.Appearance.AlignContent = 'center';

            this.Appearance.JustifyItems = 'start';
            this.Appearance.AlignItems = 'center';

        } else if (value === cCenter) {
            this.Appearance.JustifyContent = 'center';
            this.Appearance.AlignContent = 'center';

            this.Appearance.JustifyItems = 'center';
            this.Appearance.AlignItems = 'center';


        } else if (value === cTrailing) {
            this.Appearance.JustifyContent = 'end';
            this.Appearance.AlignContent = 'center';

            this.Appearance.JustifyItems = 'end';
            this.Appearance.AlignItems = 'center';

        } else if (value === cBottomLeading) {
            this.Appearance.JustifyContent = 'start';
            this.Appearance.AlignContent = 'end';

            this.Appearance.JustifyItems = 'start';
            this.Appearance.AlignItems = 'end';

        } else if (value === cBottom) {
            this.Appearance.JustifyContent = 'center';
            this.Appearance.AlignContent = 'end';

            this.Appearance.JustifyItems = 'center';
            this.Appearance.AlignItems = 'end';

        } else if (value === cBottomTrailing) {
            this.Appearance.JustifyContent = 'end';
            this.Appearance.AlignContent = 'end';

            this.Appearance.JustifyItems = 'end';
            this.Appearance.AlignItems = 'end';

        }
        return this;
    }

    /** @internal */
    @ViewProperty() vp_Draggable: boolean;
    public draggable(value: boolean) {
        this.vp_Draggable = value;
        return this;
     }


    public render() {
        return (<HStackRenderer control={this}></HStackRenderer>)
    }
}