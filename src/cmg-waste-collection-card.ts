declare global {
  interface Window {
    customCards?: Array<{
      type: string;
      name: string;
      description: string;
      preview: boolean;
    }>;
  }
}

interface WasteCollectionCardConfig {
  show_title?: boolean;
  icon_style?: 'icon' | 'colored_background';
  title?: string;
}

interface WasteType {
  name: string;
  icon: string;
  color: string;
  next_date: string | null;
  days_until: number | null;
  is_today?: boolean;
  is_tomorrow?: boolean;
  entity_id?: string;
}

interface HassEntity {
  state: string;
  attributes: {
    friendly_name?: string;
    icon?: string;
    color?: string;
    days_until?: number;
    is_today?: boolean;
    is_tomorrow?: boolean;
    entity_ids?: string[];
    [key: string]: any;
  };
}

interface Hass {
  states: {
    [entity_id: string]: HassEntity;
  };
}

class WasteCollectionCard extends HTMLElement {
  private _config!: WasteCollectionCardConfig;
  private _hass?: Hass;
  private _expanded: boolean = false;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  public setConfig(config: WasteCollectionCardConfig): void {
    this._config = {
      show_title: false,
      icon_style: 'icon',
      title: 'Waste Collection',
      ...config,
    };
    this.render();
  }

  public set hass(hass: Hass) {
    const oldHass = this._hass;
    this._hass = hass;

    // Only re-render if relevant sensors changed
    if (!oldHass) {
      this.render();
      return;
    }

    // Check if sensor list changed
    const sensorList = hass.states['sensor.waste_collection_waste_sensors'];
    const oldSensorList = oldHass.states['sensor.waste_collection_waste_sensors'];

    if (!oldSensorList || !sensorList) {
      this.render();
      return;
    }

    // Check if any individual waste sensor changed
    const entityIds = sensorList.attributes.entity_ids || [];
    let hasChanges = false;

    for (const entityId of entityIds) {
      const newState = hass.states[entityId];
      const oldState = oldHass.states[entityId];

      if (!oldState || !newState || oldState.state !== newState.state) {
        hasChanges = true;
        break;
      }
    }

    if (hasChanges) {
      this.render();
    }
  }

  private _toggleExpanded(): void {
    this._expanded = !this._expanded;
    this.render();
  }

  private _getTodayTypes(): WasteType[] {
    if (!this._hass) {
      return [];
    }

    // Get list of all sensor entity IDs
    const sensorListEntity = this._hass.states['sensor.waste_collection_waste_sensors'];
    if (!sensorListEntity) {
      return [];
    }

    const entityIds = sensorListEntity.attributes.entity_ids || [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayTypes = [];

    for (const entityId of entityIds) {
      const sensor = this._hass.states[entityId];
      if (!sensor || sensor.state === 'unavailable' || sensor.state === 'unknown') continue;

      try {
        const nextDate = new Date(sensor.state);
        nextDate.setHours(0, 0, 0, 0);

        if (nextDate.getTime() === today.getTime()) {
          todayTypes.push({
            name: sensor.attributes.friendly_name?.replace('Waste Collection ', '') || 'Unknown',
            icon: sensor.attributes.icon || 'mdi:delete',
            color: sensor.attributes.color || '#000000',
            next_date: sensor.state,
            days_until: 0,
            is_today: true,
            entity_id: entityId,
          });
        }
      } catch (e) {
        console.warn('[CMG Card] Error parsing date for', entityId, e);
      }
    }

    return todayTypes;
  }

  private _getTomorrowTypes(): WasteType[] {
    if (!this._hass) {
      return [];
    }

    // Get list of all sensor entity IDs
    const sensorListEntity = this._hass.states['sensor.waste_collection_waste_sensors'];
    if (!sensorListEntity) {
      return [];
    }

    const entityIds = sensorListEntity.attributes.entity_ids || [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const tomorrowTypes = [];

    for (const entityId of entityIds) {
      const sensor = this._hass.states[entityId];
      if (!sensor || sensor.state === 'unavailable' || sensor.state === 'unknown') continue;

      try {
        const nextDate = new Date(sensor.state);
        nextDate.setHours(0, 0, 0, 0);

        if (nextDate.getTime() === tomorrow.getTime()) {
          tomorrowTypes.push({
            name: sensor.attributes.friendly_name?.replace('Waste Collection ', '') || 'Unknown',
            icon: sensor.attributes.icon || 'mdi:delete',
            color: sensor.attributes.color || '#000000',
            next_date: sensor.state,
            days_until: 1,
            is_tomorrow: true,
            entity_id: entityId,
          });
        }
      } catch (e) {
        console.warn('[CMG Card] Error parsing date for', entityId, e);
      }
    }

    return tomorrowTypes;
  }

  private _getAllMonitoredTypes(): WasteType[] {
    if (!this._hass) return [];

    // Get list of all sensor entity IDs
    const sensorListEntity = this._hass.states['sensor.waste_collection_waste_sensors'];
    if (!sensorListEntity) {
      return [];
    }

    const entityIds = sensorListEntity.attributes.entity_ids || [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result = [];

    for (const entityId of entityIds) {
      const sensor = this._hass.states[entityId];
      if (!sensor || sensor.state === 'unavailable' || sensor.state === 'unknown') continue;

      try {
        const nextDate = new Date(sensor.state);
        nextDate.setHours(0, 0, 0, 0);
        const daysUntil = Math.floor((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        result.push({
          name: sensor.attributes.friendly_name?.replace('Waste Collection ', '') || 'Unknown',
          icon: sensor.attributes.icon || 'mdi:delete',
          color: sensor.attributes.color || '#000000',
          next_date: sensor.state,
          days_until: daysUntil,
          is_today: daysUntil === 0,
          is_tomorrow: daysUntil === 1,
          entity_id: entityId,
        });
      } catch (e) {
        console.warn('[CMG Card] Error parsing date for', entityId, e);
      }
    }

    // Sort by next date
    result.sort((a, b) => new Date(a.next_date!).getTime() - new Date(b.next_date!).getTime());

    return result;
  }

  private _getWasteTypeInfo(name: string): WasteType | null {
    if (!this._hass) return null;

    const normalized = this._normalizeForEntityId(name);
    const sensorEntityId = `sensor.waste_collection_${normalized}`;

    const sensorEntity = this._hass.states[sensorEntityId];
    if (!sensorEntity) {
      console.warn(`Sensor not found for ${name}: ${sensorEntityId}`);
      return {
        name,
        icon: 'mdi:delete',
        color: '#000000',
        next_date: null,
        days_until: null,
        is_today: false,
        is_tomorrow: false,
      };
    }

    return {
      name,
      icon: sensorEntity.attributes.icon || 'mdi:delete',
      color: sensorEntity.attributes.color || '#000000',
      next_date: sensorEntity.state !== 'unknown' && sensorEntity.state !== 'unavailable' ? sensorEntity.state : null,
      days_until: sensorEntity.attributes.days_until ?? null,
      is_today: sensorEntity.attributes.is_today || false,
      is_tomorrow: sensorEntity.attributes.is_tomorrow || false,
    };
  }

  private _normalizeForEntityId(name: string): string {
    // Match sensor.py normalization: just lowercase and replace spaces
    return name
      .toLowerCase()
      .replace(/ /g, '_');
  }

  private _getDaysText(type: WasteType): string {
    if (type.days_until === null) return '';
    if (type.days_until === 0) return 'dziś';
    if (type.days_until === 1) return 'jutro';
    if (type.days_until < 7) return `za ${type.days_until} dni`;
    const weeks = Math.floor(type.days_until / 7);
    if (weeks === 1) return 'za tydzień';
    if (weeks < 5) return `za ${weeks} tygodnie`;
    return `za ${weeks} tygodni`;
  }

  private _getDaysClass(daysUntil: number | null): string {
    if (daysUntil === null) return '';
    if (daysUntil === 0) return 'today';
    if (daysUntil === 1) return 'tomorrow';
    if (daysUntil < 7) return 'this-week';
    return '';
  }

  private _formatDate(dateStr: string): string {
    try {
      const date = new Date(dateStr);
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      return `${day}.${month}`;
    } catch {
      return dateStr;
    }
  }

  private _renderIcon(type: WasteType): string {
    const iconStyle = this._config.icon_style === 'colored_background'
      ? `background-color: ${type.color}20; color: ${type.color};`
      : `color: ${type.color};`;

    return `
      <div class="waste-icon" style="${iconStyle}" title="${type.name}">
        <ha-icon icon="${type.icon}"></ha-icon>
      </div>
    `;
  }

  private _renderExpandedType(type: WasteType): string {
    const daysText = this._getDaysText(type);
    const dateDisplay = type.next_date
      ? `
        <span class="date-value">${this._formatDate(type.next_date)}</span>
        <span class="days-until ${this._getDaysClass(type.days_until)}">${daysText}</span>
      `
      : '<span class="no-date">Brak dat</span>';

    return `
      <div class="waste-type-row">
        <div class="waste-info">
          <ha-icon icon="${type.icon}" style="color: ${type.color};"></ha-icon>
          <span class="waste-name">${type.name}</span>
        </div>
        <div class="waste-date">
          ${dateDisplay}
        </div>
      </div>
    `;
  }

  private _getSensorIcon(entityId: string, fallbackIcon: string): string {
    if (!this._hass) return fallbackIcon;

    const sensor = this._hass.states[entityId];
    if (!sensor) return fallbackIcon;

    return sensor.attributes.icon || fallbackIcon;
  }

  private render(): void {
    if (!this._hass || !this._config || !this.shadowRoot) return;

    const todayTypes = this._getTodayTypes();
    const tomorrowTypes = this._getTomorrowTypes();
    const allMonitoredTypes = this._getAllMonitoredTypes();

    const todayIcons = todayTypes.length > 0
      ? todayTypes.map(t => this._renderIcon(t)).join('')
      : '<ha-icon icon="mdi:border-none-variant" style="color: var(--secondary-text-color); --mdi-icon-size: 24px;"></ha-icon>';

    const tomorrowIcons = tomorrowTypes.length > 0
      ? tomorrowTypes.map(t => this._renderIcon(t)).join('')
      : '<ha-icon icon="mdi:border-none-variant" style="color: var(--secondary-text-color); --mdi-icon-size: 24px;"></ha-icon>';

    // Get icons from sensors
    const todayLabelIcon = this._getSensorIcon('sensor.waste_collection_today_collection', 'mdi:calendar-today');
    const tomorrowLabelIcon = this._getSensorIcon('sensor.waste_collection_tomorrow_collection', 'mdi:calendar');

    const expandIcon = this._expanded ? 'mdi:chevron-up' : 'mdi:calendar-multiselect';

    const expandedView = this._expanded && allMonitoredTypes.length > 0
      ? `
        <div class="expanded-view">
          <div class="divider"></div>
          ${allMonitoredTypes.map(t => this._renderExpandedType(t)).join('')}
        </div>
      `
      : '';

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }

        ha-card {
          padding: 12px;
        }

        .card-header {
          font-size: 20px;
          font-weight: 500;
          margin-bottom: 12px;
        }

        .card-content {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .compact-view {
          display: flex;
          flex-direction: row;
          align-items: center;
          gap: 16px;
          padding: 8px 0;
        }

        .day-section {
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 1;
        }

        .day-label {
          font-weight: 500;
          font-size: 14px;
          color: var(--secondary-text-color);
          white-space: nowrap;
        }

        .day-label-icon {
          --mdi-icon-size: 24px;
          color: var(--secondary-text-color);
          flex-shrink: 0;
        }

        .icons-row {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          align-items: center;
        }

        .waste-icon {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.2s;
        }

        .waste-icon:hover {
          transform: scale(1.1);
        }

        .waste-icon ha-icon {
          --mdi-icon-size: 20px;
        }

        .no-collection {
          color: var(--secondary-text-color);
          font-style: italic;
        }

        .expand-button {
          display: flex;
          justify-content: center;
          padding: 8px;
          cursor: pointer;
          color: var(--primary-text-color);
          opacity: 0.6;
          transition: opacity 0.2s;
        }

        .expand-button:hover {
          opacity: 1;
        }

        .divider {
          height: 1px;
          background-color: var(--divider-color);
          margin: 8px 0;
        }

        .expanded-view {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .waste-type-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          border-radius: 6px;
          background-color: var(--secondary-background-color);
        }

        .waste-info {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .waste-info ha-icon {
          --mdi-icon-size: 20px;
        }

        .waste-name {
          font-weight: 500;
          font-size: 14px;
        }

        .waste-date {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 2px;
        }

        .date-value {
          font-weight: 500;
          font-size: 13px;
        }

        .days-until {
          font-size: 11px;
          color: var(--secondary-text-color);
        }

        .days-until.today {
          color: var(--error-color);
          font-weight: 600;
        }

        .days-until.tomorrow {
          color: var(--warning-color);
          font-weight: 600;
        }

        .days-until.this-week {
          color: var(--info-color);
        }

        .no-date {
          color: var(--secondary-text-color);
          font-style: italic;
        }
      </style>

      <ha-card>
        ${this._config.show_title && this._config.title ? `<div class="card-header">${this._config.title}</div>` : ''}

        <div class="card-content">
          <div class="compact-view">
            <div class="day-section">
              <ha-icon icon="${todayLabelIcon}" class="day-label-icon" title="Dzisiaj"></ha-icon>
              <div class="icons-row">${todayIcons}</div>
            </div>

            <div class="day-section">
              <ha-icon icon="${tomorrowLabelIcon}" class="day-label-icon" title="Jutro"></ha-icon>
              <div class="icons-row">${tomorrowIcons}</div>
            </div>

            <div class="expand-button">
              <ha-icon icon="${expandIcon}"></ha-icon>
            </div>
          </div>

          ${expandedView}
        </div>
      </ha-card>
    `;

    // Add click handler to expand button
    const expandButton = this.shadowRoot.querySelector('.expand-button');
    if (expandButton) {
      expandButton.addEventListener('click', () => this._toggleExpanded());
    }
  }

  public getCardSize(): number {
    return this._expanded ? 5 + this._getAllMonitoredTypes().length : 3;
  }

  public static getStubConfig(): WasteCollectionCardConfig {
    return {
      title: 'Waste Collection',
      show_title: false,
      icon_style: 'icon',
    };
  }
}

customElements.define('cmg-waste-collection-card', WasteCollectionCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'cmg-waste-collection-card',
  name: 'CMG Waste Collection Card',
  description: 'A card to display waste collection schedule',
  preview: true,
});

console.info(
  '%c CMG-WASTE-COLLECTION-CARD %c Version 0.0.1',
  'color: orange; font-weight: bold; background: black',
  'color: white; font-weight: bold; background: dimgray'
);

export {};