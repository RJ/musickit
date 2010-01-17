#ifndef QUERY_H
#define QUERY_H

#include <QObject>
#include <QList>
#include <QSharedPointer>
#include <QDebug>

#include "qplaydar.h"
#include "qplaydar/client.h"
#include "qplaydar/result.h"

namespace Playdar {

class Query : public QObject
{
Q_OBJECT
Q_PROPERTY(QString qid READ qid WRITE setQid)
Q_PROPERTY(QString artist READ artist WRITE setArtist)
Q_PROPERTY(QString album  READ album  WRITE setAlbum)
Q_PROPERTY(QString track  READ track  WRITE setTrack)
Q_PROPERTY(int duration READ duration WRITE setDuration)
public:
    explicit Query(QObject *parent = 0);

    QString str() const;
    const QString & qid() const;
    const QString & artist() const;
    const QString & album() const;
    const QString & track() const;
    const QList< r_ptr > & results() const;

    int duration() const;
    void setQid(const QString& id);
    void setArtist(const QString& name);
    void setAlbum(const QString& name);
    void setTrack(const QString& name);
    void setDuration(int dur);

    void addResult(r_ptr res);

signals:
    void onResult(Playdar::r_ptr res);

public slots:

private:
    QString m_qid, m_artist, m_album, m_track;
    int m_duration;
    QList< r_ptr > m_results;

};
} // ns
#endif // QUERY_H
