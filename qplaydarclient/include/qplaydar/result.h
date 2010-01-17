#ifndef RESULT_H
#define RESULT_H

#include <QObject>

namespace Playdar
{

class Result : public QObject
{
Q_OBJECT
Q_PROPERTY(QString sid READ sid       WRITE setSid)
Q_PROPERTY(QString artist   READ artist   WRITE setArtist)
Q_PROPERTY(QString album    READ album    WRITE setAlbum)
Q_PROPERTY(QString track    READ track    WRITE setTrack)
Q_PROPERTY(QString mimetype READ mimetype WRITE setMimetype)
Q_PROPERTY(QString source   READ source   WRITE setSource)
Q_PROPERTY(int     size     READ size     WRITE setSize)
Q_PROPERTY(int     bitrate  READ bitrate  WRITE setBitrate)
Q_PROPERTY(int     duration READ duration WRITE setDuration)
Q_PROPERTY(float   score    READ score    WRITE setScore)
public:
    explicit Result(QObject *parent = 0);

    QString sid() const;
    QString artist() const;
    QString album() const;
    QString track() const;
    QString mimetype() const;
    QString source() const;
    QString str() const;
    int size() const;
    int bitrate() const;
    int duration() const;
    float score() const;

    void setSid(const QString& id);
    void setArtist(const QString& what);
    void setAlbum (const QString& what);
    void setTrack (const QString& what);
    void setMimetype(const QString& what);
    void setSource(const QString& what);
    void setSize(int size);
    void setBitrate(int bitrate);
    void setDuration(int duration);
    void setScore(float score);


signals:

public slots:

private:
    float m_score;
    int m_size, m_bitrate, m_duration;
    QString m_artist, m_track, m_album, m_mimetype, m_source, m_sid;
};

} // ns
#endif // RESULT_H
