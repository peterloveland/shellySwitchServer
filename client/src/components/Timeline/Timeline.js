import React from 'react';
import styles from './Timeline.module.scss';

export default class Timeline extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
    
    };
  }
  render() {
    let hourTimelineJSX = []
    for (let hour = 1; hour <= 24; hour++) {
      hourTimelineJSX.push(
        <div
          key={hour}
          className={styles.hourContainer}
        >
          {hour}
        </div>
      )
    }
    return (
      <div className={`${styles.allHours}`}>
        {hourTimelineJSX}
      </div>
    )

  }
}